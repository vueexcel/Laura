const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { generateAIResponse, getChatHistory, clearChatHistory, getChatEntryDetail, tagMoment, getMoments, migrateMoments, getUserBehavior } = require('../controllers/responseController');
const { protect } = require('../middleware/authMiddleware');

// Configure multer storage for audio files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    // Save with original extension
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

router.post('/generate', upload.single('audio'), generateAIResponse);
router.get('/history', getChatHistory);
router.get('/history/:id', getChatEntryDetail);
router.delete('/history', clearChatHistory);

// New routes for moments feature
router.post('/moments/migrate', migrateMoments); // This must come before the :id route
router.post('/moments/:id', tagMoment);
router.get('/moments', getMoments);

// User behavior tracking route
router.get('/behavior', getUserBehavior);

module.exports = router;