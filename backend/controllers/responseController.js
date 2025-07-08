const asyncHandler = require('express-async-handler');
const { generateResponse, getChatHistoryForUser, clearChatHistoryForUser, getChatEntryById, semanticSearch, tagChatEntryAsMoment, getMomentsForUser, migrateMomentsToNewFormat } = require('../helpers/firestoreHelper');
const { textToSpeech, getVoiceIdFromEmotionTag } = require('../helpers/audioHelper');
const { transcribeAudio } = require('../helpers/transcriptionHelper');
const fs = require('fs');
const path = require('path');
// Removed MongoDB AiChat schema import as we're using Firestore

const generateAIResponse = asyncHandler(async (req, res) => {
    // Get userId from authenticated user or use a test ID
    // In production, this should come from req.user.id after authentication
    const userId = req.user ? req.user.id : "test_user_id";
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

        // Generate response using Firestore implementation
        // This will automatically save the chat history to Firestore
        const response = await generateResponse(userText, userId);
        
        // Extract emotion tag from response if available, or use a default
        let emotionTag = 'neutral';
        let cleanResponse = response;
        let chatId = null;
        
        // If response is an object with emotionTag property (from firestoreHelper)
        if (typeof response === 'object' && response.emotionTag) {
            emotionTag = response.emotionTag;
            cleanResponse = response.response;
            chatId = response.id; // Get the chat ID from the response
        }
        
        // Get voice ID based on emotion tag
        const voiceId = getVoiceIdFromEmotionTag(emotionTag);
        
        // Generate audio with the selected voice ID
        const audioBuffer = await textToSpeech(cleanResponse, voiceId);

        // Set response headers for JSON response
        res.setHeader('Content-Type', 'application/json');

        // Send text, emotion tag, voice ID, chat ID, and audio response
        res.status(200).json({
            success: true,
            response: cleanResponse,
            emotionTag: emotionTag,
            voiceId: voiceId,
            id: chatId, // Include the chat ID in the response
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
    // Get userId from authenticated user or use a test ID
    // In production, this should come from req.user.id after authentication
    const userId = req.user ? req.user.id : "test_user_id";

    try {
        // Get limit from query params or default to 10
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        
        // Check if semantic search is requested
        if (req.query.search) {
            // Perform semantic search using Firestore
            const searchResults = await semanticSearch(userId, req.query.search, limit);
            
            res.status(200).json({
                success: true,
                chatHistory: searchResults,
                searchQuery: req.query.search
            });
        } else {
            // Use the Firestore helper function to get regular chat history
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
    // Get userId from authenticated user or use a test ID
    // In production, this should come from req.user.id after authentication
    const userId = req.user ? req.user.id : "test_user_id";

    try {
        // Use Firestore helper to clear chat history
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
    // Get userId from authenticated user or use a test ID
    // In production, this should come from req.user.id after authentication
    const userId = req.user ? req.user.id : "test_user_id";
    const chatId = req.params.id;

    if (!chatId) {
        return res.status(400).json({
            success: false,
            error: 'Chat entry ID is required'
        });
    }

    try {
        // Use Firestore helper to get chat entry by ID
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

/**
 * Tags a chat entry as a "Moment" with a custom label and timestamp
 */
const tagMoment = asyncHandler(async (req, res) => {
    // Get userId from authenticated user or use a test ID
    const userId = req.user ? req.user.id : "test_user_id";
    const chatId = req.params.id;

    if (!chatId) {
        return res.status(400).json({
            success: false,
            error: 'Chat entry ID is required'
        });
    }

    // Validate request body
    if (!req.body.label) {
        return res.status(400).json({
            success: false,
            error: 'Label is required for tagging a moment'
        });
    }

    const momentData = {
        label: req.body.label,
        timestamp: req.body.timestamp || new Date().toISOString()
    };

    try {
        // Use Firestore helper to tag the chat entry as a moment
        const updatedEntry = await tagChatEntryAsMoment(userId, chatId, momentData);

        if (!updatedEntry) {
            return res.status(404).json({
                success: false,
                error: 'Chat entry not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Chat entry tagged as a moment successfully',
            chatEntry: updatedEntry,
            id: chatId // Include the chat ID in the response
        });
    } catch (error) {
        console.error('Error tagging moment:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to tag chat entry as a moment'
        });
    }
});

/**
 * Gets all moments for a user, optionally filtered by label
 */
const getMoments = asyncHandler(async (req, res) => {
    // Get userId from authenticated user or use a test ID
    const userId = req.user ? req.user.id : "test_user_id";
    const label = req.query.label || null;

    try {
        // Use Firestore helper to get moments
        const moments = await getMomentsForUser(userId, label);

        // Ensure each moment has its ID clearly visible in the top level of the response
        const momentsWithIds = moments.map(moment => ({
            ...moment,
            id: moment.id // Ensure ID is at the top level
        }));

        res.status(200).json({
            success: true,
            moments: momentsWithIds
        });
    } catch (error) {
        console.error('Error fetching moments:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch moments'
        });
    }
});

/**
 * Migrates existing moments to the new format
 */
const migrateMoments = asyncHandler(async (req, res) => {
    // Get userId from authenticated user or use a test ID
    const userId = req.user ? req.user.id : "test_user_id";

    try {
        // Use Firestore helper to migrate moments
        const migratedCount = await migrateMomentsToNewFormat(userId);

        res.status(200).json({
            success: true,
            message: `Successfully migrated ${migratedCount} moments to new format`,
            migratedCount
        });
    } catch (error) {
        console.error('Error migrating moments:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to migrate moments'
        });
    }
});

module.exports = { 
    generateAIResponse, 
    getChatHistory, 
    clearChatHistory, 
    getChatEntryDetail,
    tagMoment,
    getMoments,
    migrateMoments
};