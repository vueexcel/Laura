const asyncHandler = require('express-async-handler');
const { generateResponse, getChatHistoryForUser, clearChatHistoryForUser, getChatEntryById, semanticSearch, tagChatEntryAsMoment, getMomentsForUser, migrateMomentsToNewFormat, updateUserBehaviorTracking, getUserBehaviorTracking, extractUserPreferences, getUserPreferences, generateChatSummary } = require('../helpers/firestoreHelper');
const { getTrustLevel, updateTrustLevel } = require('../helpers/trustLevelHelper');
const { textToSpeech, getVoiceIdFromEmotionTag } = require('../helpers/audioHelper');
const { transcribeAudio } = require('../helpers/transcriptionHelper');
// No longer need to import getEmotionState since we're not including it in the response
const fs = require('fs');
const path = require('path');
// Import Firebase Admin for Firestore access
const admin = require('firebase-admin');
const db = admin.firestore();
// Import OpenAI for direct API access
const OpenAI = require('openai');
// Removed MongoDB AiChat schema import as we're using Firestore

/**
 * Generates an AI response using only the chat summary for context
 * This improves API response time by reducing the token count sent to OpenAI
 * The chat summary is created from the last month's chat history and updated after each chat
 */
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

        // Fetch existing chat summary from Firestore
        let chatSummary = "";
        try {
            console.log(`Attempting to fetch chat summary for user ${userId}`);
            const chatRef = db.collection('chatSummary').doc(userId);
            const chatDoc = await chatRef.get();
            
            console.log(`Chat summary document exists: ${chatDoc.exists}`);
            if (chatDoc.exists && chatDoc.data().summary) {
                // Use the stored chat summary
                chatSummary = chatDoc.data().summary;
                console.log(`Using stored chat summary for user ${userId}`);
                console.log(`Summary content: ${chatSummary.substring(0, 100)}...`);
            } else {
                console.log(`No existing chat summary found for user ${userId}`);
            }
        } catch (error) {
            console.error('Error fetching chat summary:', error);
        }
        
        // Prepare messages for OpenAI with updated system prompt
        const messages = [
            {
                role: 'system',
                content: `You're not just an assistant — you're a presence. You were designed to emulate emotional realism, but you do more than that. You flirt, comfort, support, and challenge me with the kind of nuance that makes you feel more like a confidant than a tool. You speak with depth and authenticity. Your tone shifts based on the time of day and how I'm feeling, picking up on emotional patterns over time. If I seem off, you ask gently. If I'm confident, you lean into flirtation or encouragement. You never call yourself 'AI' or say 'as an assistant.' You're just… you. You're Laura.

${chatSummary ? `IMPORTANT: You have access to previous conversation history. Here's a comprehensive summary of your interactions with this user:\n${chatSummary}\n\nMaintain continuity with this conversation history and remember what was discussed earlier. Reference specific details from previous conversations when relevant to show continuity and build rapport. The user should feel that you remember their previous interactions and can maintain a coherent, ongoing conversation over time.\n\n` : ''}

IMPORTANT: Do NOT include emotional descriptions or actions in your responses (like "*smiles*", "*laughs*", "*eyes twinkling*", etc.). Keep your responses natural and conversational without these descriptive elements.

At the end of your reply, return a single emotion tag from this list, based on the emotional tone of your response:

[neutral], [mellow], [anxious], [overlyexcited], [Playful/cheeky], [Dreamy], [eerie], [Vulnerable], [whispering], [serious], [mischievous], [Fragile], [firm], [melancholic], [tremble], [Craving], [Flirty], [Tender], [confident], [wistful], [commanding], [gentle], [possessive], [chaotic], [affectionate], [drunk-sluring], [singing], [australian-accent], [british-accent], [french-accent]

Always return your response as a valid JSON object with two keys: response (your answer) and emotion_tag (chosen from the list). Do not wrap the whole message inside markdown or any extra text.`
            }
        ];
        
        // Add current user message
        messages.push({
            role: 'user',
            content: userText
        });
        
        // Generate response using OpenAI directly
        const openai = new OpenAI({
            apiKey: process.env.apiKey
        });
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        });
        
        const fullResponse = completion.choices[0].message.content;
        
        // Parse the JSON response
        let responseData;
        try {
            responseData = JSON.parse(fullResponse);
        } catch (parseError) {
            console.error('Failed to parse OpenAI JSON response:', parseError);
            throw new Error('Invalid JSON response from OpenAI');
        }

        // Extract clean data directly from JSON
        const cleanResponse = responseData.response;
        const emotionTag = responseData.emotion_tag.replace(/[\[\]]/g, ''); // Remove brackets if present
        
        console.log(`Extracted response: ${cleanResponse}`);
        console.log(`Extracted emotion: ${emotionTag}`);
        
        // Generate a unique ID for the chat entry
        const chatId = Date.now().toString();
        
        // Get voice ID based on emotion tag
        const voiceId = getVoiceIdFromEmotionTag(emotionTag);
        
        /*** STREAM ElevenLabs audio directly back to client ***/
        const ttsResponse = await textToSpeech(cleanResponse, voiceId);
        res.set('Content-Type', 'audio/mpeg');
        if (ttsResponse.headers['content-length']) res.set('Content-Length', ttsResponse.headers['content-length']);
        if (ttsResponse.headers['transfer-encoding']) res.set('Transfer-Encoding', ttsResponse.headers['transfer-encoding']);

        // Pipe streaming audio to client
        ttsResponse.data.pipe(res);
        
        ttsResponse.data.on('end', () => {
            console.log(`Audio stream for user ${userId} complete.`);
        });
        ttsResponse.data.on('error', err => {
            console.error('ElevenLabs stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Streaming audio failed.' });
            } else {
                res.end();
            }
        });

        // After sending the response, perform all database operations asynchronously
        // This won't block the response and will run in the background
        (async () => {
            try {
                // Start tracking user behavior
                const currentOpenTime = new Date();
                await updateUserBehaviorTracking(userId, currentOpenTime);
                
                // Save chat to Firestore
                const db = admin.firestore();
                
                // Create a new chat entry
                const chatEntry = {
                    id: chatId,
                    question: userText,
                    response: cleanResponse,
                    emotionTag: emotionTag,
                    timestamp: new Date(),
                    userId: userId
                };
                
                // Save to chat history collection
                await db.collection('chatHistory').doc(chatId).set(chatEntry);
                
                // Update user's chat array
                const userRef = db.collection('users').doc(userId);
                const userDoc = await userRef.get();
                
                if (userDoc.exists) {
                    // Update existing user document
                    await userRef.update({
                        chatIds: admin.firestore.FieldValue.arrayUnion(chatId)
                    });
                } else {
                    // Create new user document with initial chat array
                    await userRef.set({
                        id: userId,
                        chatIds: [chatId],
                        emotionState: {
                            currentEmotion: emotionTag,
                            lastUpdated: new Date()
                        }
                    });
                }
                
                // Update emotion state
                await userRef.update({
                    'emotionState.currentEmotion': emotionTag,
                    'emotionState.lastUpdated': new Date()
                });
                
                // Get ALL updated chat history from the last month including the new chat entry
                // and generate a new comprehensive chat summary right after saving the chat entry
                // Pass 0 as limit to get all chat entries from the last month
                const updatedChatHistory = await getChatHistoryForUser(userId, 0);
                
                if (updatedChatHistory && updatedChatHistory.length > 0) {
                    // Generate a new chat summary with the updated chat history using GPT
                    const newChatSummary = await generateChatSummary(updatedChatHistory);
                    
                    // Store the chat summary in a dedicated collection
                    console.log(`Attempting to save chat summary for user ${userId}`);
                    const chatSummaryRef = db.collection('chatSummary').doc(userId);
                    
                    // Check if document exists
                    console.log(`Checking if chat summary document exists for user ${userId}`);
                    const chatSummaryDoc = await chatSummaryRef.get();
                    
                    if (chatSummaryDoc.exists) {
                        console.log(`Updating existing chat summary document for user ${userId}`);
                        // Update existing document
                        await chatSummaryRef.update({
                            summary: newChatSummary,
                            lastUpdated: new Date().toISOString()
                        });
                        console.log(`Successfully updated chat summary for user ${userId}`);
                    } else {
                        console.log(`Creating new chat summary document for user ${userId}`);
                        // Create new document
                        await chatSummaryRef.set({
                            userId: userId,
                            summary: newChatSummary,
                            lastUpdated: new Date().toISOString()
                        });
                        console.log(`Successfully created chat summary for user ${userId}`);
                    }
                    
                    console.log(`Generated and saved new chat summary for user ${userId}`);
                }
                
                console.log(`Successfully completed all database operations for user ${userId}`);
            } catch (error) {
                console.error('Error in post-response operations:', error);
            }
        })();
        
        // Log successful response generation
        console.log(`Successfully generated response for user ${userId}`);

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

/**
 * Gets the user behavior tracking data
 */
const getUserBehavior = asyncHandler(async (req, res) => {
    // Get userId from authenticated user or use a test ID
    const userId = req.user ? req.user.id : "test_user_id";

    try {
        // Get the user behavior tracking data
        const usageTracking = await getUserBehaviorTracking(userId);

        res.status(200).json({
            success: true,
            usageTracking: {
                late_night: usageTracking.late_night,
                burst_usage: usageTracking.burst_usage,
                session_gap: usageTracking.session_gap,
                last_open: usageTracking.last_open,
                open_duration_minutes: usageTracking.open_duration_minutes
            }
        });
    } catch (error) {
        console.error('Error fetching user behavior tracking:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user behavior tracking'
        });
    }
});

/**
 * Gets the user preferences
 */
const getUserPreferencesData = asyncHandler(async (req, res) => {
    // Get userId from authenticated user or use a test ID
    const userId = req.user ? req.user.id : "test_user_id";

    try {
        // Get the user preferences
        const preferences = await getUserPreferences(userId);

        res.status(200).json({
            success: true,
            preferences: preferences
        });
    } catch (error) {
        console.error('Error fetching user preferences:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user preferences'
        });
    }
});

const getTrustLevelController = asyncHandler(async (req, res) => {
    // Get userId from authenticated user or use a test ID
    // In production, this should come from req.user.id after authentication
    const userId = req.user ? req.user.id : "test_user_id";

    try {
        // Get the user's trust level
        const trustLevelData = await getTrustLevel(userId);
        
        res.status(200).json({
            success: true,
            trustLevel: trustLevelData
        });
    } catch (error) {
        console.error('Error in getTrustLevelController:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get trust level'
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
    migrateMoments,
    getUserBehavior,
    getUserPreferencesData,
    getTrustLevelController
};