const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe'); // adjust path if needed
const upload = require('../utils/multer');  // ✅ this is your multer file
const cloudinary = require('../utils/cloudinary'); // your cloudinary config

// ✅ Create new recipe with image upload
router.post('/', upload.single('image'), async (req, res) => {
    try {
        console.log('req.file:', req.file);     // ✅ Now it's valid
        console.log('req.body:', req.body);     // ✅ Now it's valid

        const result = await cloudinary.uploader.upload(req.file.path);
        const recipe = new Recipe({
            ...req.body,
            imageUrl: result.secure_url
        });
        await recipe.save();
        res.status(201).json(recipe);
    } catch (err) {
        console.error('Upload or save error:', err);  // Better debug message
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;


router.get('/recipes', async (req, res) => {
  try {
    const recipes = await Recipe.find().sort({ createdAt: -1 });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});