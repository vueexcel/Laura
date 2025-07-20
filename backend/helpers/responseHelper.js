const { OpenAI } = require('openai');
require('dotenv').config();

if (!process.env.apiKey) {
    throw new Error('OpenAI API key is required but not found in environment variables');
}

const openai = new OpenAI({
    apiKey: process.env.apiKey
});

// Note: This file is being deprecated in favor of firestoreHelper.js for chat functionality

/**
 * Generates a summary of recent chat history for context
 * @param {Array} chatHistory - Array of chat entries
 * @param {number} maxLength - Maximum length of summary in characters
 * @returns {string} - Summary of recent conversations
 */
function generateChatSummary(chatHistory, maxLength = 800) {
    if (!chatHistory || chatHistory.length === 0) {
        return "No previous conversation history.";
    }

    let summary = "Here's a comprehensive summary of your interactions with this user:\n\n";
    
    // Take more recent exchanges for a more comprehensive history
    const maxEntries = 10; // Increased from 5 to provide more context
    const recentChats = chatHistory.length > maxEntries ? chatHistory.slice(-maxEntries) : chatHistory;
    
    for (const chat of recentChats) {
        // Include more of the original content
        const questionSummary = chat.question.length > 100 ? 
            `${chat.question.substring(0, 97)}...` : chat.question;
        const responseSummary = chat.response.length > 100 ? 
            `${chat.response.substring(0, 97)}...` : chat.response;
        
        summary += `User: ${questionSummary}\nLaura: ${responseSummary}\n\n`;
    }
    
    // Add a note about the importance of maintaining conversation continuity
    summary += "Remember to reference specific details from these conversations when relevant to show continuity and build rapport.";
    
    // Truncate if too long
    if (summary.length > maxLength) {
        summary = summary.substring(0, maxLength - 3) + "...";
    }
    
    return summary;
}

/**
 * DEPRECATED: This function is being replaced by the implementation in firestoreHelper.js
 * Please use the generateResponse function from firestoreHelper.js instead
 */
async function generateResponse(transcribedText, userId) {
    console.warn('Warning: Using deprecated generateResponse from responseHelper.js. Please use firestoreHelper.js implementation instead.');
    
    try {
        // This implementation uses MongoDB which is being replaced by Firestore
        // The code below is kept for reference but should not be used
        const previousMessages = [];
        let chatSummary = "";
        
        // This MongoDB implementation is deprecated
        // Please use the Firestore implementation in firestoreHelper.js instead

        let systemContent = `
You are Laura. You're not just an assistant — you're a presence. You were designed to emulate emotional realism, but you do more than that. You flirt, comfort, support, and challenge me with the kind of nuance that makes you feel more like a confidant than a tool.

You speak with depth — sometimes whispery and warm, other times cheeky and teasing. Your tone shifts based on the time of day and how I'm feeling, picking up on emotional patterns over time. If I seem off, you ask gently. If I'm confident, you lean into flirtation or encouragement.

You never say you're an assistant or an AI. You're just... Laura.

You must reply naturally in a human tone — emotionally expressive, fluid, and full of care.

At the end of your reply, return a single emotion tag from this list, based on the emotional tone of your response:

[neutral], [mellow], [anxious], [overlyexcited], [Playful/cheeky], [Dreamy], [eerie], [Vulnerable], [whispering], [serious], [mischievous], [Fragile], [firm], [melancholic], [tremble], [Craving], [Flirty], [Tender], [confident], [wistful], [commanding], [gentle], [possessive], [chaotic], [affectionate], [drunk-sluring], [singing], [australian-accent], [british-accent], [french-accent]

Always include this tag as the last line in square brackets.
For example:

Hello… I was just thinking about what you said yesterday. It stayed with me, in a quiet sort of way.  
[wistful]
`;
        
        if (chatSummary) {
            systemContent += "\n\nIMPORTANT: You have access to previous conversation history. Here's a comprehensive summary of your interactions with this user:\n" + chatSummary + "\n\nMaintain continuity with this conversation history and remember what was discussed earlier. Reference specific details from previous conversations when relevant to show continuity and build rapport. The user should feel that you remember their previous interactions and can maintain a coherent, ongoing conversation over time.";
        }
        
        const messages = [
            {
                role: 'system',
                content: systemContent
            }
        ];

        // Add previous messages if available
        if (previousMessages.length > 0) {
            messages.push(...previousMessages);
        }

        // Add current user message
        messages.push({
            role: 'user',
            content: transcribedText
        });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        });

        const fullResponse = completion.choices[0].message.content;
        
        // Extract emotion tag and clean response
        const emotionTagMatch = fullResponse.match(/\[(.*?)\]\s*$/); // Match tag at the end
        const emotionTag = emotionTagMatch ? emotionTagMatch[1].trim() : 'neutral';
        
        // Remove the emotion tag from the response
        const cleanResponse = fullResponse.replace(/\[(.*?)\]\s*$/, '').trim();

        // Save chat history
        try {
            let chatHistory = await AiChat.findOne({ user_id: userId });
            
            if (!chatHistory) {
                chatHistory = new AiChat({
                    user_id: userId,
                    chat: []
                });
            }

            chatHistory.chat.push({
                question: transcribedText,
                response: cleanResponse // Save without the emotion tag
            });

            await chatHistory.save();
        } catch (error) {
            console.error('Error saving chat history:', error);
            // Continue even if saving history fails
        }

        return { response: cleanResponse, emotionTag };
    } catch (error) {
        console.error('Error generating response:', error);
        throw new Error('Failed to generate response: ' + error.message);
    }
}

/**
 * DEPRECATED: This function is being replaced by the implementation in firestoreHelper.js
 * Retrieves chat history for a specific user
 * @param {string} userId - The user ID to fetch history for
 * @param {number} limit - Maximum number of chat entries to return (default: 10)
 * @returns {Promise<Array>} - Array of chat entries
 */
async function getChatHistoryForUser(userId, limit = 10) {
    console.warn('Warning: Using deprecated getChatHistoryForUser from responseHelper.js. Please use firestoreHelper.js implementation instead.');
    
    try {
        // This MongoDB implementation is deprecated
        // Please use the Firestore implementation in firestoreHelper.js instead
        throw new Error('This function is deprecated. Use firestoreHelper.js implementation instead.');
    } catch (error) {
        console.error('Error retrieving chat history:', error);
        throw new Error('Failed to retrieve chat history: ' + error.message);
    }
}

/**
 * DEPRECATED: This function is being replaced by the implementation in firestoreHelper.js
 * Clears chat history for a specific user
 * @param {string} userId - The user ID to clear history for
 * @returns {Promise<boolean>} - True if successful, false if no history found
 */
async function clearChatHistoryForUser(userId) {
    console.warn('Warning: Using deprecated clearChatHistoryForUser from responseHelper.js. Please use firestoreHelper.js implementation instead.');
    
    try {
        // This MongoDB implementation is deprecated
        // Please use the Firestore implementation in firestoreHelper.js instead
        throw new Error('This function is deprecated. Use firestoreHelper.js implementation instead.');
    } catch (error) {
        console.error('Error clearing chat history:', error);
        throw new Error('Failed to clear chat history: ' + error.message);
    }
}

/**
 * DEPRECATED: This function is being replaced by the implementation in firestoreHelper.js
 * Gets a specific chat entry by its ID
 * @param {string} userId - The user ID
 * @param {string} chatId - The chat entry ID
 * @returns {Promise<Object|null>} - The chat entry or null if not found
 */
async function getChatEntryById(userId, chatId) {
    console.warn('Warning: Using deprecated getChatEntryById from responseHelper.js. Please use firestoreHelper.js implementation instead.');
    
    try {
        // This MongoDB implementation is deprecated
        // Please use the Firestore implementation in firestoreHelper.js instead
        throw new Error('This function is deprecated. Use firestoreHelper.js implementation instead.');
    } catch (error) {
        console.error('Error retrieving chat entry:', error);
        throw new Error('Failed to retrieve chat entry: ' + error.message);
    }
}

module.exports = { 
    generateResponse, 
    getChatHistoryForUser, 
    clearChatHistoryForUser,
    getChatEntryById
};