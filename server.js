require('dotenv').config();
console.log("NODE_EXTRA_CA_CERTS:", process.env.NODE_EXTRA_CA_CERTS);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const recipeRoutes = require('./routes/recipeRoutes');
const path = require('path');
const cloudinary = require('cloudinary').v2; // ADDED
const multer = require('multer'); // ADDED

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================================
// Cloudinary Configuration (ADDED)
// ==========================================================
cloudinary.config({
 cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
 api_key: process.env.CLOUDINARY_API_KEY,
 api_secret: process.env.CLOUDINARY_API_SECRET
});

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

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected');
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
    })
    .catch(err => console.error('DB connection error:', err));