require('dotenv').config();
console.log("NODE_EXTRA_CA_CERTS:", process.env.NODE_EXTRA_CA_CERTS);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const recipeRoutes = require('./routes/recipeRoutes');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/recipes', recipeRoutes);



// Define the full path to your index.html file
const indexPath = path.join(__dirname, 'public', 'index.html');

// Log the path to verify it's correct
console.log('Attempting to serve HTML from path:', indexPath);

app.get('/', (req, res) => {
  res.sendFile(indexPath, (err) => {
    if (err) {
      // This callback catches errors specifically from sendFile, e.g., file not found
      console.error('Error sending index.html:', err);
      // You can send a more user-friendly error page here if needed
      res.status(500).send('Internal Server Error: Could not load page.');
    }
  });
});

// Optional: Add a general error-handling middleware for any unhandled errors
// This should be placed after all your routes and other middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack); // Log the full stack trace
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