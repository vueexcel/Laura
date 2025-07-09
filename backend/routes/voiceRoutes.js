const express = require('express');
const router = express.Router();
const { generateComfortResponse } = require('../controllers/voiceController');
const { protect } = require('../middleware/authMiddleware');

/**
 * @route POST /api/voice/comfort
 * @desc Generate a comfort response with breathwork technique
 * @access Public
 */
router.post('/comfort', generateComfortResponse);

module.exports = router;