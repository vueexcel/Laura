const asyncHandler = require('express-async-handler');
const { generateResponse, getChatHistoryForUser, clearChatHistoryForUser, getChatEntryById } = require('../helpers/responseHelper');
const { textToSpeech } = require('../helpers/audioHelper');
const { transcribeAudio } = require('../helpers/transcriptionHelper');
const AiChat = require('../schemas/AiChat');
const fs = require('fs');
const path = require('path');

const generateAIResponse = asyncHandler(async (req, res) => {
    // Temporarily using a fixed userId for testing without authentication
    const userId = "test_user_id";
    try {
        let userText;
        
        // Check if audio file is provided in the request
        if (req.file) {
            // Transcribe the audio file to text
            const audioFilePath = req.file.path;
            userText = await transcribeAudio(audioFilePath);
            
            // Delete the temporary file after transcription
            fs.unlink(audioFilePath, (err) => {
                if (err) console.error('Error deleting temporary audio file:', err);
            });
        } else if (req.body.transcribedText) {
            // Use provided text if no audio file
            userText = req.body.transcribedText;
        } else {
            return res.status(400).json({
                success: false,
                error: 'Either audio file or transcribed text is required'
            });
        }

        const textResponse = await generateResponse(userText, userId);
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

const getChatHistory = asyncHandler(async (req, res) => {
    // Temporarily using a fixed userId for testing without authentication
    const userId = "test_user_id";

    try {
        // Get limit from query params or default to 10
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        
        // Use the helper function to get chat history
        const chatHistory = await getChatHistoryForUser(userId, limit);

        res.status(200).json({
            success: true,
            chatHistory: chatHistory
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch chat history'
        });
    }
});

const clearChatHistory = asyncHandler(async (req, res) => {
    // Temporarily using a fixed userId for testing without authentication
    const userId = "test_user_id";

    try {
        const result = await clearChatHistoryForUser(userId);

        res.status(200).json({
            success: true,
            message: result ? 'Chat history cleared successfully' : 'No chat history found to clear'
        });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to clear chat history'
        });
    }
});

const getChatEntryDetail = asyncHandler(async (req, res) => {
    // Temporarily using a fixed userId for testing without authentication
    const userId = "test_user_id";
    const chatId = req.params.id;

    if (!chatId) {
        return res.status(400).json({
            success: false,
            error: 'Chat entry ID is required'
        });
    }

    try {
        const chatEntry = await getChatEntryById(userId, chatId);

        if (!chatEntry) {
            return res.status(404).json({
                success: false,
                error: 'Chat entry not found'
            });
        }

        res.status(200).json({
            success: true,
            chatEntry: chatEntry
        });
    } catch (error) {
        console.error('Error fetching chat entry:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch chat entry'
        });
    }
});

module.exports = { generateAIResponse, getChatHistory, clearChatHistory, getChatEntryDetail };