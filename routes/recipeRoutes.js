const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary'); // ✅ Fixed import
const cloudinary = require('cloudinary').v2;
const router = express.Router();

// ==========================================================
// Configure Cloudinary
// ==========================================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================================
// Setup Multer for Cloudinary Image Upload
// ==========================================================
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'utils',
        allowed_formats: ['jpg', 'jpeg', 'png'], // ✅ Added allowed formats
        transformation: [{ width: 800, height: 600, crop: 'limit' }], // ✅ Added image optimization
        public_id: (req, file) => {
            // ✅ Better file naming
            const timestamp = Date.now();
            const fileName = file.originalname.split('.')[0]; // Remove extension
            return `recipe-${fileName}-${timestamp}`;
        },
    },
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // ✅ 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // ✅ File type validation
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// ==========================================================
// Mongoose Schema & Model
// ==========================================================
const recipeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200 // ✅ Added validation
    },
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
    }
});

const Recipe = mongoose.model('Recipe', recipeSchema);

// ==========================================================
// API Routes
// ==========================================================

// GET all recipes
router.get('/', async (req, res) => {
    try {
        const recipes = await Recipe.find().sort({ createdAt: -1 });
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

// POST a new recipe (with image upload)
router.post('/', upload.single('image'), async (req, res) => { // ✅ Changed from 'recipeImage' to 'image' to match React
    try {
        const { title, ingredients, instructions } = req.body;

        // ✅ Improved validation
        if (!title || !ingredients || !instructions) {
            return res.status(400).json({ 
                message: 'Missing required fields: title, ingredients, and instructions are required' 
            });
        }

        // ✅ Parse JSON data with error handling
        let parsedIngredients, parsedInstructions;
        
        try {
            parsedIngredients = JSON.parse(ingredients);
            parsedInstructions = JSON.parse(instructions);
        } catch (parseError) {
            return res.status(400).json({ 
                message: 'Invalid JSON format for ingredients or instructions' 
            });
        }

        // ✅ Validate parsed data
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

        // ✅ Get image URL from Cloudinary
        const imageUrl = req.file ? req.file.path : null;

        const newRecipe = new Recipe({
            title: title.trim(),
            ingredients: parsedIngredients.map(ing => ({
                name: ing.name?.trim(),
                amount: ing.amount?.trim()
            })),
            instructions: parsedInstructions.map(inst => inst.trim()),
            imageUrl
        });

        const savedRecipe = await newRecipe.save();
        
        console.log('Recipe saved successfully:', savedRecipe._id);
        
        res.status(201).json({
            message: 'Recipe saved successfully!',
            recipe: savedRecipe // ✅ Return the saved recipe
        });

    } catch (error) {
        console.error('Error saving recipe:', error);
        
        // ✅ Handle different types of errors
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

// DELETE a recipe
router.delete('/:id', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        // ✅ Delete image from Cloudinary if it exists
        if (recipe.imageUrl) {
            try {
                const publicId = recipe.imageUrl.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`recipe-share-app/${publicId}`);
            } catch (cloudinaryError) {
                console.error('Error deleting image from Cloudinary:', cloudinaryError);
                // Continue with recipe deletion even if image deletion fails
            }
        }

        await Recipe.findByIdAndDelete(req.params.id);
        
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        console.error('Error deleting recipe:', error);
        res.status(500).json({ 
            message: 'Failed to delete recipe',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ✅ Error handling middleware for multer
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

module.exports = router;