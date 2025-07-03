const asyncHandler = require('express-async-handler');
const { generateResponse } = require('../helpers/responseHelper');
const { textToSpeech } = require('../helpers/audioHelper');

const generateAIResponse = asyncHandler(async (req, res) => {
    try {
        const { transcribedText } = req.body;

        if (!transcribedText) {
            return res.status(400).json({
                success: false,
                error: 'Transcribed text is required'
            });
        }

        const textResponse = await generateResponse(transcribedText);
        const audioBuffer = await textToSpeech(textResponse);

        // Set response headers for JSON response
        res.setHeader('Content-Type', 'application/json');

        // Send both text and audio response
        res.status(200).json({
            success: true,
            response: textResponse,
            audio: audioBuffer.toString('base64')
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