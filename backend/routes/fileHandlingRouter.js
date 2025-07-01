const express = require('express');
const router = express.Router();
const { uploadFileApi } = require('../controllers/fileHandlingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/upload', protect, uploadFileApi)

module.exports = router
