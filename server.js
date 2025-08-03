require('dotenv').config();
console.log("NODE_EXTRA_CA_CERTS:", process.env.NODE_EXTRA_CA_CERTS);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const recipeRoutes = require('./routes/recipeRoutes');
const path = require('path');
const Recipe = require('./models/Recipe');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/recipes', recipeRoutes);

// ==========================================================
// Serve static files from the 'public' directory (CHANGED)
// ==========================================================
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================
// Catch-all route to serve index.html for SPAs (CHANGED)
// ==========================================================
app.get('*', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Optional: Add a general error-handling middleware for any unhandled errors
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).send('Something unexpected broke!');
});

app.post('/api/recipes/:id/rate', async (req, res) => {
    try {
        const { rating } = req.body;
        const recipeId = req.params.id;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        // For MongoDB with Mongoose:
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        // Add rating to recipe
        if (!recipe.ratings) {
            recipe.ratings = [];
        }
        recipe.ratings.push({ rating });
        
        // Calculate average
        const total = recipe.ratings.reduce((sum, r) => sum + r.rating, 0);
        recipe.averageRating = total / recipe.ratings.length;
        recipe.ratingsCount = recipe.ratings.length;
        
        await recipe.save();
        
        res.json({ 
            message: 'Rating added successfully',
            averageRating: recipe.averageRating,
            ratingsCount: recipe.ratingsCount
        });
        
    } catch (error) {
        console.error('Error adding rating:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. Add comment to a recipe
app.post('/api/recipes/:id/comment', async (req, res) => {
    try {
        const { text } = req.body;
        const recipeId = req.params.id;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ message: 'Comment text is required' });
        }

        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        const newComment = {
            text: text.trim(),
            createdAt: new Date()
        };

        if (!recipe.comments) {
            recipe.comments = [];
        }
        recipe.comments.unshift(newComment);
        
        await recipe.save();
        
        res.json({ 
            message: 'Comment added successfully',
            comment: newComment
        });
        
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. Get comments for a recipe
app.get('/api/recipes/:id/comments', async (req, res) => {
    try {
        const recipeId = req.params.id;
        
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        
        res.json(recipe.comments || []);
        
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.post('/', upload.single('image'), async (req, res) => {
    try {
        console.log('=== POST DEBUGGING START ===');
        console.log('File received:', !!req.file);
        console.log('Request body:', req.body);
        console.log('=== POST DEBUGGING END ===');

        const { title, category, cookingTime, difficulty, tags, ingredients, instructions } = req.body;

        // Extract user data from form
        const formCreatedBy = req.body.createdBy;
        const formCreatedByName = req.body.createdByName;
        const formCreatedByEmail = req.body.createdByEmail;

        // Validation
        if (!title || !category || !ingredients || !instructions) {
            return res.status(400).json({ 
                message: 'Missing required fields: title, category, ingredients, and instructions are required' 
            });
        }

        // Parse JSON data
        let parsedIngredients, parsedInstructions, parsedTags;
        
        try {
            parsedIngredients = ingredients ? JSON.parse(ingredients) : [];
            parsedInstructions = instructions ? JSON.parse(instructions) : [];
            parsedTags = tags ? JSON.parse(tags) : [];
        } catch (parseError) {
            return res.status(400).json({ 
                message: 'Invalid JSON format for ingredients, instructions, or tags' 
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
            cookingTime: Number(cookingTime),
            difficulty: difficulty.toLowerCase(),
            tags: Array.isArray(parsedTags) ? parsedTags.map(tag => tag.trim().toLowerCase()) : [],
            ingredients: parsedIngredients.map(ing => ({
                name: ing.name?.trim(),
                amount: ing.amount?.trim()
            })),
            instructions: parsedInstructions.map(inst => inst.trim()),
            imageUrl,
            createdBy: formCreatedBy || 'anonymous',
            createdByName: formCreatedByName || 'Anonymous',
            createdByEmail: formCreatedByEmail || '',
            createdAt: new Date()
        });

        const savedRecipe = await newRecipe.save();
        res.status(201).json(savedRecipe);

    } catch (error) {
        console.error('Error creating recipe:', error);
        res.status(500).json({ 
            message: 'Failed to create recipe',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected');
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
    })
    .catch(err => console.error('DB connection error:', err));


const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

// Middleware to verify Firebase token
async function authenticateUser(req, res, next) {
    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (token) {
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.user = decodedToken;
        }
        next();
    } catch (error) {
        console.error('Auth error:', error);
        next(); // Continue without user for public endpoints
    }
}

// Middleware to check recipe ownership
async function checkRecipeOwnership(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        const recipe = await Recipe.findById(req.params.id); // Adjust based on your DB
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        
        if (recipe.createdBy !== req.user.uid) {
            return res.status(403).json({ message: 'You can only modify your own recipes' });
        }
        
        req.recipe = recipe;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}


app.delete('/api/recipes/:id', authenticateUser, checkRecipeOwnership, async (req, res) => {
    try {
        await Recipe.findByIdAndDelete(req.params.id);
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete recipe' });
    }
});

// PUT /api/recipes/:id  
app.put('/api/recipes/:id', authenticateUser, checkRecipeOwnership, async (req, res) => {
    try {
        const updatedRecipe = await Recipe.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true }
        );
        res.json(updatedRecipe);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update recipe' });
    }
});