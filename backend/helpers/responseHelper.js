const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

if (!process.env.apiKey) {
    throw new Error('OpenAI API key is required but not found in environment variables');
}

const openai = new OpenAI({
    apiKey: process.env.apiKey
});

// Load persona configuration
let personaSystem = null;
let responsePatterns = null;
const backstoryStates = new Map(); // Track backstory progression per user

/**
 * Initialize the persona system by loading configuration files
 */
async function initializePersonaSystem() {
    try {
        const [personaData, patternsData] = await Promise.all([
            fs.readFile(path.join(__dirname, '../prompts/persona_system.json'), 'utf8'),
            fs.readFile(path.join(__dirname, '../prompts/response_patterns.json'), 'utf8')
        ]);
        
        personaSystem = JSON.parse(personaData);
        responsePatterns = JSON.parse(patternsData);
    } catch (error) {
        console.error('Error initializing persona system:', error);
        throw error;
    }
}

// Initialize on module load
initializePersonaSystem().catch(console.error);

/**
 * Get time-based greeting based on current hour
 * @returns {Object} Greeting and emotion tag
 */
function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    let timeOfDay;
    
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    return responsePatterns.time_based_responses[timeOfDay];
}

/**
 * Track and progress through backstory states for each user
 */
function handleBackstoryProgression(userId) {
    const currentState = backstoryStates.get(userId) || 0;
    if (currentState < personaSystem.backstory_progression.length - 1) {
        backstoryStates.set(userId, currentState + 1);
    }
    return currentState;
}

/**
 * Check for pre-defined trigger responses
 */
function checkTriggers(userInput, userId) {
    const normalizedInput = userInput.toLowerCase();
    
    // Check for backstory trigger
    const creationRegex = /(who|how) (made|created|built|designed) you|where (did|do) you come from|what is your origin/;

    if (creationRegex.test(normalizedInput)) {
        const backstoryIndex = handleBackstoryProgression(userId);
        return {
            response: personaSystem.backstory_progression[backstoryIndex],
            emotionTag: backstoryIndex === 0 ? 'Tender' : 
                backstoryIndex === 1 ? 'Vulnerable' : 'wistful'
        };
    }

    // Check other triggers
    for (const trigger of responsePatterns.triggers) {
        if (normalizedInput.includes(trigger.trigger.toLowerCase())) {
            return {
                response: trigger.response,
                emotionTag: trigger.emotion_tag
            };
        }
    }

    return null;
}

/**
 * Generate the system prompt based on current context
 */
function generateSystemPrompt(chatSummary = '', mode = 'neutral') {
    if (!personaSystem) {
        throw new Error('Persona system not initialized');
    }

    const { core_prompt, emotional_principles, conversation_modes } = personaSystem;
    
    let prompt = `${core_prompt}\n\n`;
    prompt += "**Emotional Intelligence & Persona Principles:**\n";
    
    Object.entries(emotional_principles).forEach(([key, value]) => {
        prompt += `- **${key.replace('_', ' ')}:** ${value}\n`;
    });

    if (chatSummary) {
        prompt += `\nPrevious Conversation Context:\n${chatSummary}\n`;
    }

    prompt += `\nCurrent Mode: ${conversation_modes[mode]}\n\n`;
    prompt += "Remember: Never use emotional descriptions or actions (like *smiles*, *laughs*, etc).\n";
    prompt += "Format your response as a JSON object with 'response' and 'emotion_tag' keys.\n";
    prompt += `Available emotion tags: ${personaSystem.emotion_tags.join(', ')}`;

    return prompt;
}

/**
 * Generate a response using the persona system
 * @param {string} userInput - The user's message
 * @param {string} userId - The user's ID
 * @param {string} chatSummary - Previous chat summary
 * @param {string} mode - Conversation mode (neutral, advice, focus)
 * @returns {Promise<Object>} Response and emotion tag
 */
async function generateResponse(userInput, userId, chatSummary = '', mode = 'neutral') {
    try {
        // First check for pre-defined triggers
        const triggeredResponse = checkTriggers(userInput, userId);
        if (triggeredResponse) {
            return triggeredResponse;
        }

        // Generate dynamic response using OpenAI
        const systemPrompt = generateSystemPrompt(chatSummary, mode);
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { 
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userInput
                }
            ],
            temperature: 0.8,
            max_tokens: 500
        });

        const responseText = completion.choices[0].message.content;
        
        try {
            // Parse the JSON response
            const parsedResponse = JSON.parse(responseText);
            return {
                response: parsedResponse.response,
                emotionTag: parsedResponse.emotion_tag
            };
        } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            // Fallback to using the raw response with a neutral emotion
            return {
                response: responseText.replace(/\[(.*?)\]\s*$/, '').trim(),
                emotionTag: 'neutral'
            };
        }
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
    getTimeBasedGreeting,
    checkTriggers,
    handleBackstoryProgression,
    generateSystemPrompt
};