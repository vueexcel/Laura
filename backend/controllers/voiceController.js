const asyncHandler = require('express-async-handler');
const { textToSpeech, getVoiceIdFromEmotionTag } = require('../helpers/audioHelper');
const { updateEmotionState, getEmotionAwarePrompt } = require('../helpers/emotionMemoryHelper');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');
require('dotenv').config();

// Get Firestore database instance
const db = admin.firestore();

/**
 * Generate a comfort response with breathwork technique
 * @route POST /api/voice/comfort
 * @access Public
 */
const generateComfortResponse = asyncHandler(async (req, res) => {
    // Get userId from authenticated user or use a test ID
    const userId = req.user ? req.user.id : "test_user_id";
    
    try {
        // Get text from request body
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'Text is required in the request body'
            });
        }

        // Initialize OpenAI
        if (!process.env.apiKey) {
            throw new Error('OpenAI API key is required but not found in environment variables');
        }

        const openai = new OpenAI({
            apiKey: process.env.apiKey
        });
        
        // Update the emotion state based on the user's input
        await updateEmotionState(userId, text);
        
        // Create base system prompt for comfort response
        const baseSystemPrompt = `You are a calming presence designed to help people relax and find comfort. 

Respond in a calm, gentle, and soothing tone. Speak slowly and clearly, as if guiding someone through anxiety or helping them relax before sleep. Start with a short breathwork technique like 4-7-8 breathing or box breathing. Follow it with one comforting line or affirmation. Keep responses minimal, warm, and emotionally supportive—like a quiet, caring voice at bedtime.

At the end of your reply, return a single emotion tag from this list, based on the emotional tone of your response:
[gentle], [mellow], [tender], [whispering], [dreamy]

Always include this tag as the last line in square brackets.`;
        
        // Get the emotion-aware system prompt
        const systemPrompt = await getEmotionAwarePrompt(userId, baseSystemPrompt);

        // Create messages array
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: text
            }
        ];

        // Generate response using OpenAI
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            temperature: 0.7,
            max_tokens: 300
        });

        const fullResponse = completion.choices[0].message.content;
        
        // Extract emotion tag and clean response
        const emotionTagMatch = fullResponse.match(/\[(.*?)\]\s*$/);
        const emotionTag = emotionTagMatch ? emotionTagMatch[1].trim() : 'gentle';
        
        // Remove the emotion tag from the response
        const cleanResponse = fullResponse.replace(/\[(.*?)\]\s*$/, '').trim();
        
        // Update the emotion state based on the response
        await updateEmotionState(userId, cleanResponse, emotionTag);

        // Save chat entry to Firestore
        try {
            // Generate a unique ID for the chat entry
            const chatId = Date.now().toString();
            
            // Create the new chat entry
            const newChatEntry = {
                id: chatId,
                userId: userId,
                question: text,
                response: cleanResponse,
                emotionTag: emotionTag,
                timestamp: new Date(),
                // Add a flag to identify this as a comfort response
                isComfortResponse: true
            };
            
            // Save the chat entry to the chatHistory collection
            await db.collection('chatHistory').doc(chatId).set(newChatEntry);
            
            // Update the user's chatIds array
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                // Add the new chatId to the user's chatIds array
                await userRef.update({
                    chatIds: admin.firestore.FieldValue.arrayUnion(chatId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Create a new user document if it doesn't exist
                await userRef.set({
                    userId: userId,
                    chatIds: [chatId],
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Get voice ID based on emotion tag
            const voiceId = getVoiceIdFromEmotionTag(emotionTag);
            
            // Generate audio with the selected voice ID
            const audioBuffer = await textToSpeech(cleanResponse, voiceId);
            
            // Send response
            res.status(200).json({
                success: true,
                response: cleanResponse,
                emotionTag: emotionTag,
                voiceId: voiceId,
                id: chatId,
                audio: audioBuffer.toString('base64')
            });

        } catch (error) {
            console.error('Error saving chat entry:', error);
            
            // Generate a fallback ID
            const fallbackId = Date.now().toString();
            
            // Get voice ID based on emotion tag
            const voiceId = getVoiceIdFromEmotionTag(emotionTag);
            
            // Generate audio with the selected voice ID
            const audioBuffer = await textToSpeech(cleanResponse, voiceId);
            
            // Still return a response even if saving fails
            res.status(200).json({
                success: true,
                response: cleanResponse,
                emotionTag: emotionTag,
                voiceId: voiceId,
                id: fallbackId,
                audio: audioBuffer.toString('base64')
            });
        }

    } catch (error) {
        console.error('Error in generateComfortResponse:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate comfort response'
        });
    }
});

module.exports = {
    generateComfortResponse
};