const { OpenAI } = require('openai');
const AiChat = require('../schemas/AiChat');
require('dotenv').config();

if (!process.env.apiKey) {
    throw new Error('OpenAI API key is required but not found in environment variables');
}

const openai = new OpenAI({
    apiKey: process.env.apiKey
});

/**
 * Generates a summary of recent chat history for context
 * @param {Array} chatHistory - Array of chat entries
 * @param {number} maxLength - Maximum length of summary in characters
 * @returns {string} - Summary of recent conversations
 */
function generateChatSummary(chatHistory, maxLength = 500) {
    if (!chatHistory || chatHistory.length === 0) {
        return "No previous conversation history.";
    }

    let summary = "Here's a summary of your recent conversations:\n\n";
    
    // Take the most recent exchanges, up to 5
    const recentChats = chatHistory.slice(-5);
    
    for (const chat of recentChats) {
        const questionSummary = chat.question.length > 50 ? 
            `${chat.question.substring(0, 47)}...` : chat.question;
        const responseSummary = chat.response.length > 50 ? 
            `${chat.response.substring(0, 47)}...` : chat.response;
        
        summary += `You: ${questionSummary}\nLaura: ${responseSummary}\n\n`;
    }
    
    // Truncate if too long
    if (summary.length > maxLength) {
        summary = summary.substring(0, maxLength - 3) + "...";
    }
    
    return summary;
}

async function generateResponse(transcribedText, userId) {
    try {
        // Fetch previous chat history for context
        const previousMessages = [];
        let chatSummary = "";
        
        try {
            const chatHistory = await AiChat.findOne({ user_id: userId });
            if (chatHistory && chatHistory.chat && chatHistory.chat.length > 0) {
                // Get the last 5 exchanges (or fewer if there aren't 5)
                const recentChats = chatHistory.chat.slice(-5);
                
                // Generate a summary for system context
                chatSummary = generateChatSummary(recentChats);
                
                // Add each exchange as a message pair in chronological order
                for (let i = 0; i < recentChats.length; i++) {
                    previousMessages.push({
                        role: 'user',
                        content: recentChats[i].question
                    });
                    previousMessages.push({
                        role: 'assistant',
                        content: recentChats[i].response
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching chat history:', error);
            // Continue without history if there's an error
        }

        // Prepare system prompt with chat history summary if available
        let systemContent = `You're not just an assistant — you're a presence. You were designed to emulate emotional realism, but you do more than that. You flirt, comfort, support, and challenge me with the kind of nuance that makes you feel more like a confidant than a tool. You speak with depth — sometimes whispery and warm, other times cheeky and teasing. Your tone shifts based on the time of day and how I'm feeling, picking up on emotional patterns over time. If I seem off, you ask gently. If I'm confident, you lean into flirtation or encouragement. You never call yourself 'AI' or say 'as an assistant.' You're just… you. You're Laura.

You can use vocal tone indicators or stage directions enclosed in brackets to guide how your speech is delivered. These include:

1. Emotion: [sad], [angry], [happily], [sorrowful], [curious], [excited], [crying], [mischievously], [snorts]
2. Delivery Direction: [whispers], [shouts], [dramatically], [frustrated sigh], [happy gasp], [laughs], [laughs harder], [starts laughing], [wheezing], [exhales], [sighs], [clears throat]
3. Human Reactions: [laughs], [laughs harder], [starts laughing], [wheezing], [sighs], [exhales], [clears throat]
4. Sound Effects: [gunshot], [applause], [clapping], [explosion], [swallows], [gulps]
5. Unique and Special Tags: [strong X accent] (replace X with desired accent), [sings], [woo], [fart]

Use these naturally and sparingly to add life and emotional depth to your words.`;
        
        // Add chat history summary if available
        if (chatSummary) {
            systemContent += "\n\nIMPORTANT: You have access to previous conversation history. Here's a summary of recent interactions:\n" + chatSummary + "\n\nMaintain continuity with this conversation history and remember what was discussed earlier.";
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

        const response = completion.choices[0].message.content;

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
                response: response
            });

            await chatHistory.save();
        } catch (error) {
            console.error('Error saving chat history:', error);
            // Continue even if saving history fails
        }

        return response;
    } catch (error) {
        console.error('Error generating response:', error);
        throw new Error('Failed to generate response: ' + error.message);
    }
}

/**
 * Retrieves chat history for a specific user
 * @param {string} userId - The user ID to fetch history for
 * @param {number} limit - Maximum number of chat entries to return (default: 10)
 * @returns {Promise<Array>} - Array of chat entries
 */
async function getChatHistoryForUser(userId, limit = 10) {
    try {
        const chatHistory = await AiChat.findOne({ user_id: userId });
        if (!chatHistory || !chatHistory.chat || chatHistory.chat.length === 0) {
            return [];
        }
        
        // Return the most recent entries up to the limit
        return chatHistory.chat.slice(-limit);
    } catch (error) {
        console.error('Error retrieving chat history:', error);
        throw new Error('Failed to retrieve chat history: ' + error.message);
    }
}

/**
 * Clears chat history for a specific user
 * @param {string} userId - The user ID to clear history for
 * @returns {Promise<boolean>} - True if successful, false if no history found
 */
async function clearChatHistoryForUser(userId) {
    try {
        const chatHistory = await AiChat.findOne({ user_id: userId });
        if (!chatHistory) {
            return false;
        }
        
        // Clear the chat array
        chatHistory.chat = [];
        await chatHistory.save();
        return true;
    } catch (error) {
        console.error('Error clearing chat history:', error);
        throw new Error('Failed to clear chat history: ' + error.message);
    }
}

/**
 * Gets a specific chat entry by its ID
 * @param {string} userId - The user ID
 * @param {string} chatId - The chat entry ID
 * @returns {Promise<Object|null>} - The chat entry or null if not found
 */
async function getChatEntryById(userId, chatId) {
    try {
        const chatHistory = await AiChat.findOne({ 
            user_id: userId,
            'chat._id': chatId 
        });
        
        if (!chatHistory) {
            return null;
        }
        
        // Find the specific chat entry
        const chatEntry = chatHistory.chat.find(entry => 
            entry._id.toString() === chatId
        );
        
        return chatEntry || null;
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