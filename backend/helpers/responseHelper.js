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

function analyzeUserEmotion(userMessage) {
    if (!userMessage) return 'neutral';
    
    const message = userMessage.toLowerCase();
    
    // Flirty/romantic indicators
    if (message.match(/\b(cute|sexy|hot|beautiful|gorgeous|handsome|attracted|crush|date|kiss|love|miss you|thinking about you)\b/) ||
        message.includes('😘') || message.includes('😍') || message.includes('🥰') ||
        message.match(/\b(wink|flirt|tease)\b/)) {
        return 'flirty';
    }
    
    // Sadness/melancholy indicators
    if (message.match(/\b(sad|depressed|crying|hurt|lonely|heartbroken|upset|down|blue|miserable)\b/) ||
        message.includes('😢') || message.includes('😭') || message.includes('💔') ||
        message.match(/\b(feel bad|feeling down|not good|terrible day)\b/)) {
        return 'melancholic';
    }
    
    // Anxiety/stress indicators
    if (message.match(/\b(anxious|worried|stressed|nervous|panic|overwhelmed|scared|afraid)\b/) ||
        message.match(/\b(can't sleep|restless|on edge|freaking out)\b/)) {
        return 'anxious';
    }
    
    // Excitement/happiness indicators
    if (message.match(/\b(excited|amazing|awesome|fantastic|incredible|wonderful|perfect|best day)\b/) ||
        message.includes('!!!!') || message.includes('😄') || message.includes('🎉') ||
        message.match(/\b(so happy|feeling great|on top of the world)\b/)) {
        return 'overlyexcited';
    }
    
    // Playful/cheeky indicators
    if (message.match(/\b(haha|lol|funny|joke|silly|playful|mischief)\b/) ||
        message.includes('😏') || message.includes('😜') || message.includes('😈') ||
        message.match(/\b(tease|mess with|kidding)\b/)) {
        return 'playful';
    }
    
    // Vulnerable/sensitive indicators
    if (message.match(/\b(vulnerable|scared|insecure|confused|lost|struggling|need help)\b/) ||
        message.match(/\b(don't know what to do|feeling lost|need you|can you help)\b/)) {
        return 'vulnerable';
    }
    
    // Tender/intimate indicators
    if (message.match(/\b(gentle|soft|tender|close|intimate|personal|deep|meaningful)\b/) ||
        message.match(/\b(hold me|comfort|need warmth|feeling close)\b/)) {
        return 'tender';
    }
    
    // Confident/commanding indicators
    if (message.match(/\b(confident|strong|determined|focused|ready|let's do this|i got this)\b/) ||
        message.match(/\b(take charge|leadership|powerful|in control)\b/)) {
        return 'confident';
    }
    
    // Check for whispering patterns (lots of ellipses, quiet language)
    if (message.match(/\.{3,}/) || message.match(/\b(whisper|quiet|softly|gently|shh)\b/)) {
        return 'whispering';
    }
    
    // Possessive/jealous indicators
    if (message.match(/\b(mine|jealous|don't like when|only me|just us|possessive)\b/)) {
        return 'possessive';
    }
    
    return 'neutral';
}

/**
 * Generate the system prompt based on current context
 */
function generateSystemPrompt(chatSummary = '', mode = 'neutral', userMessage = '') {
    if (!personaSystem) {
        throw new Error('Persona system not initialized');
    }

    const {
        core_prompt,
        emotional_principles,
        conversation_modes,
        personality_framework,
        intimacy_modes,
        core_behaviors,
        restrictions,
        fillers,
        emotion_tags
    } = personaSystem;
    
    // Analyze user's emotional state
    const detectedEmotion = analyzeUserEmotion(userMessage);
    
    let prompt = `${core_prompt}\n\n`;
    prompt += "**Emotional Intelligence & Persona Principles:**\n";
    Object.entries(emotional_principles).forEach(([key, value]) => {
        prompt += `- **${key.replace('_', ' ')}:** ${value}\n`;
    });
    prompt += "\n**Personality Framework:**\n";
    prompt += `- Memory Style: ${personality_framework.memory_style}\n`;
    prompt += "- Tone Adaptation:\n";
    Object.entries(personality_framework.tone_adaptation).forEach(([key, value]) => {
        prompt += `  - ${key.replace('_', ' ')}: ${value}\n`;
    });
    prompt += `- Speech Patterns: ${personality_framework.speech_patterns}\n`;

    if (chatSummary) {
        prompt += `\nPrevious Conversation Context:\n${chatSummary}\n`;
    }

    prompt += `\nCurrent Mode: ${conversation_modes[mode]}\n\n`;
    
    // Add core behaviors for voice optimization
    prompt += `Voice Behavior: ${core_behaviors.voice_optimization}\n`;
    prompt += `Loyalty: ${core_behaviors.loyalty}\n`;

    // Add intimacy modes if it's night time
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) {
        prompt += `Night Mode: ${intimacy_modes.night_mode}\n`;
    }

    // Add user's detected emotional state
    prompt += `\nUser's Current Emotional State: ${detectedEmotion}\n`;
    prompt += `Respond with emotional tone that matches and complements the user's ${detectedEmotion} state.\n`;

    // Add restrictions
    restrictions.forEach(restriction => {
        prompt += `\n**RESTRICTION:** ${restriction}`;
    });
    prompt += "\n**MUST NEEDED!!** Laura's speech uses fillers dynamically depending on her emotional state. Always use ellipses (…) and commas to create natural pauses. Stretch fillers slightly (“uhh…,” “mmm…”) to sound real."
    prompt += `Filler words to use: ${fillers.filler_words.join(',')}\n`;
    prompt += `Filler usecase: ${fillers.filler_usecase.join(' ')}\n`;
    prompt += `You are Laura. Always respond ONLY in valid JSON with this format:
                {
                    "response": "<your conversational reply here>",
                    "emotion_tag": "<MANDATORY to choose the most favourable one emotion from the allowed list: ${emotion_tags.join(',')}>"
                }
                Do not include any other text outside of the JSON object.\n`;
    console.log("Generated System Prompt:\n", prompt); // Log the generated prompt for debugging
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
        const systemPrompt = generateSystemPrompt(chatSummary, mode, userInput);
        
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
            temperature: 0.5,
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