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

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected');
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
    })
    .catch(err => console.error('DB connection error:', err));