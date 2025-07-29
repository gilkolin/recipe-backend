const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Setup Multer for memory storage (temporary)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        console.log('Starting Cloudinary upload for:', filename);
        console.log('Cloudinary config check:', {
            cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
            api_key: !!process.env.CLOUDINARY_API_KEY,
            api_secret: !!process.env.CLOUDINARY_API_SECRET
        });
        
        const timestamp = Date.now();
        const publicId = `recipe-${filename}-${timestamp}`;
        
        cloudinary.uploader.upload_stream(
            {
                folder: 'recipe-app',
                public_id: publicId,
                allowed_formats: ['jpg', 'jpeg', 'png'],
                transformation: [{ width: 800, height: 600, crop: 'limit' }]
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    reject(error);
                } else {
                    console.log('Cloudinary upload success:', result.secure_url);
                    resolve(result.secure_url);
                }
            }
        ).end(buffer);
    });
};

// UPDATED Recipe schema with categories and tags
const recipeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    category: {
        type: String,
        required: true,
        enum: [
            'pastries', 'cakes', 'cookies', 'cooking', 'bread',
            'desserts', 'appetizers', 'main-dishes', 'salads', 'soups', 'beverages'
        ],
        lowercase: true
    },
    cookingTime: {
        type: Number,
        required: true
    },
    difficulty: {
        type: String,
        required: true,
        enum: ['easy', 'medium', 'hard']
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 50
    }],
    ingredients: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        amount: {
            type: String,
            required: true,
            trim: true
        }
    }],
    instructions: [{
        type: String,
        required: true,
        trim: true
    }],
    imageUrl: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },

    // 🔥 Ratings feature
    ratings: [{
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    averageRating: {
        type: Number,
        default: 0
    },
    ratingsCount: {
        type: Number,
        default: 0
    },

    // 💬 Comments feature
    comments: [{
        text: {
            type: String,
            required: true,
            trim: true
        },
        author: {
            type: String,
            default: 'Anonymous',
            trim: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
});

// 📈 Useful indexes
recipeSchema.index({ category: 1 });
recipeSchema.index({ averageRating: -1 });
recipeSchema.index({ createdAt: -1 });


const Recipe = mongoose.model('Recipe', recipeSchema);

// POST a new recipe (UPDATED with category and tags)
router.post('/', upload.single('image'), async (req, res) => {
    try {
        console.log('=== DEBUGGING START ===');
        console.log('File received:', !!req.file);
        if (req.file) {
            console.log('File details:', {
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });
        }
        
        console.log('Request body:', req.body);
        console.log('=== DEBUGGING END ===');

        const { title, category, tags, ingredients, instructions } = req.body;

        // Validation
        if (!title || !category || !ingredients || !instructions) {
            return res.status(400).json({ 
                message: 'Missing required fields: title, category, ingredients, and instructions are required' 
            });
        }

        // Parse JSON data
        let parsedIngredients, parsedInstructions, parsedTags;
        
        try {
            parsedIngredients = JSON.parse(ingredients);
            parsedInstructions = JSON.parse(instructions);
            parsedTags = tags ? JSON.parse(tags) : [];
        } catch (parseError) {
            return res.status(400).json({ 
                message: 'Invalid JSON format for ingredients, instructions, or tags' 
            });
        }

        // Validate parsed data
        if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0) {
            return res.status(400).json({ 
                message: 'Ingredients must be a non-empty array' 
            });
        }

        if (!Array.isArray(parsedInstructions) || parsedInstructions.length === 0) {
            return res.status(400).json({ 
                message: 'Instructions must be a non-empty array' 
            });
        }

        // Validate category
        const validCategories = ['pastries', 'cakes', 'cookies', 'cooking', 'bread', 'desserts', 'appetizers', 'main-dishes', 'salads', 'soups', 'beverages'];
        if (!validCategories.includes(category.toLowerCase())) {
            return res.status(400).json({ 
                message: 'Invalid category. Must be one of: ' + validCategories.join(', ')
            });
        }

        // Upload image to Cloudinary if present
        let imageUrl = null;
        if (req.file) {
            try {
                const filename = req.file.originalname.split('.')[0];
                imageUrl = await uploadToCloudinary(req.file.buffer, filename);
            } catch (uploadError) {
                console.error('Error uploading to Cloudinary:', uploadError);
                return res.status(500).json({ 
                    message: 'Failed to upload image' 
                });
            }
        }

        const newRecipe = new Recipe({
            title: title.trim(),
            category: category.toLowerCase(),
            tags: Array.isArray(parsedTags) ? parsedTags.map(tag => tag.trim().toLowerCase()) : [],
            ingredients: parsedIngredients.map(ing => ({
                name: ing.name?.trim(),
                amount: ing.amount?.trim()
            })),
            instructions: parsedInstructions.map(inst => inst.trim()),
            imageUrl
        });

        const savedRecipe = await newRecipe.save();
        console.log('Recipe saved successfully:', savedRecipe._id);

        const verification = await Recipe.findById(savedRecipe._id);
        console.log('Verification - recipe exists in DB:', !!verification);
        
        res.status(201).json({
            message: 'Recipe saved successfully!',
            recipe: savedRecipe
        });

    } catch (error) {
        console.error('Error saving recipe:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation error',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        res.status(500).json({ 
            message: 'Failed to save recipe',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET all recipes (UPDATED to support category and tag filtering)
router.get('/', async (req, res) => {
    try {
        const { category, tags, search } = req.query;
        let query = {};

        // Filter by category
        if (category) {
            query.category = category.toLowerCase();
        }

        // Filter by tags
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase());
            query.tags = { $in: tagArray };
        }

        // Search in title and ingredients
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { 'ingredients.name': { $regex: search, $options: 'i' } }
            ];
        }

        const recipes = await Recipe.find(query).sort({ createdAt: -1 });
        res.json(recipes);
    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ 
            message: 'Failed to fetch recipes',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET single recipe by ID
router.get('/:id', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (error) {
        console.error('Error fetching recipe:', error);
        res.status(500).json({ 
            message: 'Failed to fetch recipe',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// DELETE a recipe (FIXED - extract public_id correctly from Cloudinary URL)
router.delete('/:id', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        // Delete image from Cloudinary if it exists
        if (recipe.imageUrl) {
            try {
                // Extract public_id from Cloudinary URL
                // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/recipe-app/recipe-filename-timestamp.jpg
                const urlParts = recipe.imageUrl.split('/');
                const fileWithExtension = urlParts[urlParts.length - 1]; // recipe-filename-timestamp.jpg
                const fileName = fileWithExtension.split('.')[0]; // recipe-filename-timestamp
                const publicId = `recipe-app/${fileName}`;
                
                console.log('Attempting to delete image with public_id:', publicId);
                
                await cloudinary.uploader.destroy(publicId);
                console.log('Image deleted from Cloudinary successfully');
            } catch (cloudinaryError) {
                console.error('Error deleting image from Cloudinary:', cloudinaryError);
                // Continue with recipe deletion even if image deletion fails
            }
        }

        await Recipe.findByIdAndDelete(req.params.id);
        console.log('Recipe deleted successfully from database');
        
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        console.error('Error deleting recipe:', error);
        res.status(500).json({ 
            message: 'Failed to delete recipe',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET all unique tags (for tag suggestions)
router.get('/meta/tags', async (req, res) => {
    try {
        const tags = await Recipe.distinct('tags');
        res.json(tags.sort());
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ 
            message: 'Failed to fetch tags',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET recipe count by category
router.get('/meta/categories', async (req, res) => {
    try {
        const categories = await Recipe.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ 
            message: 'Failed to fetch categories',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
        }
    }
    
    if (error.message === 'Only image files are allowed!') {
        return res.status(400).json({ message: error.message });
    }

    next(error);
});

router.post('/:id/comments', async (req, res) => {
  try {
    const { text, author = 'Anonymous' } = req.body;
    if (!text) return res.status(400).json({ message: 'Comment text is required.' });

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    recipe.comments.push({ text, author });
    await recipe.save();

    res.json({ message: 'Comment added successfully' });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

router.post('/:id/ratings', async (req, res) => {
  try {
    const { rating } = req.body;
    const numericRating = parseInt(rating);

    if (!numericRating || numericRating < 1 || numericRating > 5)
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    // Add rating
    recipe.ratings.push({ rating: numericRating });

    // Recalculate average rating
    const ratingsTotal = recipe.ratings.reduce((sum, r) => sum + r.rating, 0);
    const ratingsCount = recipe.ratings.length;
    const averageRating = ratingsTotal / ratingsCount;

    recipe.averageRating = averageRating.toFixed(2); // optional: round to 2 digits
    recipe.ratingsCount = ratingsCount;

    await recipe.save();

    res.json({
      message: 'Rating submitted successfully',
      averageRating: recipe.averageRating,
      ratingsCount: recipe.ratingsCount
    });
  } catch (err) {
    console.error('Error adding rating:', err);
    res.status(500).json({ message: 'Failed to submit rating' });
  }
});
module.exports = router;