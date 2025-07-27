const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    ingredients: [String],
    instructions: String,
    imageUrl: String,
}, { timestamps: true });

module.exports = mongoose.model('Recipe', recipeSchema);