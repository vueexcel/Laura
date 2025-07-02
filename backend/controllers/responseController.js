const asyncHandler = require('express-async-handler');
const { generateResponse } = require('../helpers/responseHelper');

const generateAIResponse = asyncHandler(async (req, res) => {
    try {
        const { transcribedText } = req.body;

        if (!transcribedText) {
            return res.status(400).json({
                success: false,
                error: 'Transcribed text is required'
            });
        }

        const response = await generateResponse(transcribedText);

        res.status(200).json({
            success: true,
            response: response
        });

    } catch (error) {
        console.error('Error in generateAIResponse:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate AI response'
        });
    }
});

module.exports = { generateAIResponse };