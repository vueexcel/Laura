const asyncHandler = require('express-async-handler');
const { getChatHistoryForUser, clearChatHistoryForUser, getChatEntryById, semanticSearch } = require('../helpers/firestoreHelper');
const { generateResponse } = require('../helpers/responseHelper');
const { textToSpeech, getVoiceIdFromEmotionTag } = require('../helpers/audioHelper');
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

        // Get response with emotion tag
        const { response, emotionTag } = await generateResponse(userText, userId);
        
        // Get voice ID based on emotion tag
        const voiceId = getVoiceIdFromEmotionTag(emotionTag);
        
        // Generate audio with the selected voice ID
        const audioBuffer = await textToSpeech(response, voiceId);

        // Set response headers for JSON response
        res.setHeader('Content-Type', 'application/json');

        // Send text, emotion tag, voice ID, and audio response
        res.status(200).json({
            success: true,
            response: response,
            emotionTag: emotionTag,
            voiceId: voiceId,
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
        
        // Check if semantic search is requested
        if (req.query.search) {
            // Perform semantic search
            const searchResults = await semanticSearch(userId, req.query.search, limit);
            
            res.status(200).json({
                success: true,
                chatHistory: searchResults,
                searchQuery: req.query.search
            });
        } else {
            // Use the helper function to get regular chat history
            const chatHistory = await getChatHistoryForUser(userId, limit);

            res.status(200).json({
                success: true,
                chatHistory: chatHistory
            });
        }
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