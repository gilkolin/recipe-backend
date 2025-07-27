const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// ==========================================================
// Setup Multer for Cloudinary Image Upload
// ==========================================================
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'recipe-share-app',
        format: async (req, file) => 'png',
        public_id: (req, file) => file.originalname + '-' + Date.now(),
    },
});
const upload = multer({ storage: storage });

// ==========================================================
// Mongoose Schema & Model
// ==========================================================
const recipeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    ingredients: [{
        name: String,
        amount: String
    }],
    instructions: [String],
    imageUrl: String,
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
        res.status(500).json({ message: 'Failed to fetch recipes' });
    }
});

// POST a new recipe (with image upload)
router.post('/', upload.single('recipeImage'), async (req, res) => {
    try {
        const { title, ingredients, instructions } = req.body;
        const imageUrl = req.file ? req.file.path : null;

        const newRecipe = new Recipe({
            title,
            ingredients: JSON.parse(ingredients),
            instructions: JSON.parse(instructions),
            imageUrl
        });

        await newRecipe.save();
        res.status(201).json({ message: 'Recipe saved successfully!', newRecipe });
    } catch (error) {
        console.error('Error saving recipe:', error);
        res.status(500).json({ message: 'Failed to save recipe', error: error.message });
    }
});

module.exports = router;