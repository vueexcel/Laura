const express = require("express");
const router = express.Router();

// Importing controllers
const {
  GroqChat,
  home,
} = require("../controllers/productController");

// Importing groqPrompt controller
const {
  groqPrompt
} = require("../controllers/groqController");

// Importing middleware for authentication
const { protect } = require("../middleware/authMiddleware");

// Routes for home
router.get('/home', protect, home)
.post('/groq', protect, groqPrompt);


// Exporting the router
module.exports = router;