const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, required: true },
    cookingTime: { type: Number, required: true }, // in minutes
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    tags: [String],
    ingredients: [{
        name: { type: String, required: true },
        amount: { type: String, required: true }
    }],
    instructions: [String],
    imageUrl: String,
    
    // NEW: Rating system
    ratings: [{
        rating: { type: Number, min: 1, max: 5 },
        createdAt: { type: Date, default: Date.now }
    }],
    averageRating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    
    // NEW: Comments system
    comments: [{
        text: { type: String, required: true },
        author: { type: String, default: 'Anonymous' },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Add indexes for better performance
recipeSchema.index({ category: 1 });
recipeSchema.index({ difficulty: 1 });
recipeSchema.index({ averageRating: -1 });
recipeSchema.index({ cookingTime: 1 });
recipeSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Recipe || mongoose.model('Recipe', recipeSchema);