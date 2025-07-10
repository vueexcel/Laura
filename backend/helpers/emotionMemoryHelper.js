const admin = require('firebase-admin');
const { OpenAI } = require('openai');
require('dotenv').config();

// Get Firestore database instance
const db = admin.firestore();

// Default emotion state structure
const defaultEmotionState = {
  fatigue: 0.2,
  stress: 0.2,
  joy: 0.2,
  withdrawn: 0.2,
  talkative: 0.2,
  anxiety: 0.2,
  excitement: 0.2,
  sadness: 0.2,
  anger: 0.2,
  frustration: 0.2,
  confusion: 0.2,
  curiosity: 0.2,
  hope: 0.2,
  gratitude: 0.2,
  confidence: 0.2,
  lastUpdated: new Date().toISOString()
};

/**
 * Gets the current emotion state for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The user's emotion state
 */
async function getEmotionState(userId) {
  try {
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().emotionState) {
      // If chat document doesn't exist or has no emotion state, create default
      const defaultState = { ...defaultEmotionState };
      
      // Create a state with timestamp for the history
      const stateWithTimestamp = {
        ...defaultState,
        timestamp: new Date().toISOString()
      };
      
      // Initialize emotion history with the default state
      const emotionHistory = [stateWithTimestamp];
      
      // If chat document doesn't exist, create it
      if (!chatDoc.exists) {
        await chatRef.set({
          chat: [],
          emotionState: defaultState,
          emotionHistory: emotionHistory,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // If chat document exists but has no emotion state, add it
        await chatRef.update({
          emotionState: defaultState,
          emotionHistory: emotionHistory,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return defaultState;
    }
    
    return chatDoc.data().emotionState;
  } catch (error) {
    console.error('Error getting emotion state:', error);
    // Return default state if there's an error
    return { ...defaultEmotionState };
  }
}

/**
 * Updates the emotion state for a user based on their message
 * @param {string} userId - The user ID
 * @param {string} userMessage - The user's message
 * @param {string} [emotionTag] - Optional emotion tag from response
 * @returns {Promise<Object>} - The updated emotion state
 */
async function updateEmotionState(userId, userMessage, emotionTag = null) {
  try {
    // Get current emotion state
    const currentState = await getEmotionState(userId);
    
    // Initialize OpenAI
    if (!process.env.apiKey) {
      throw new Error('OpenAI API key is required but not found in environment variables');
    }

    const openai = new OpenAI({
      apiKey: process.env.apiKey
    });

    // Create system prompt for emotion analysis
    const systemPrompt = `You are an emotion analysis system. Analyze the user's message and identify the emotional states present.

You will be given the user's current emotional state and their new message. Your task is to update their emotional state based on the content of their message.

Return a JSON object with the updated emotion scores. Each emotion should have a score between 0.0 and 1.0, where 0.0 means the emotion is not present and 1.0 means the emotion is strongly present.

Only include emotions that are relevant to the message. For emotions not mentioned, I will apply a slight decay.

Current emotion state:
${JSON.stringify(currentState, null, 2)}

Respond ONLY with a valid JSON object containing the emotions you detect in the message and their updated scores. Do not include any explanations or text outside the JSON object.`;

    // Create messages array
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userMessage
      }
    ];

    // Generate analysis using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const analysisResponse = completion.choices[0].message.content;
    
    // Parse the JSON response
    let emotionUpdates;
    try {
      emotionUpdates = JSON.parse(analysisResponse);
    } catch (parseError) {
      console.error('Error parsing emotion analysis response:', parseError);
      return currentState; // Return current state if parsing fails
    }
    
    // Create a copy of the current state to update
    const updatedState = { ...currentState };
    
    // Track which emotions were updated
    const updatedEmotions = new Set();
    
    // Update emotions based on analysis
    for (const [emotion, score] of Object.entries(emotionUpdates)) {
      if (emotion !== 'lastUpdated' && typeof score === 'number') {
        updatedState[emotion] = Math.max(0, Math.min(1, score)); // Ensure score is between 0 and 1
        updatedEmotions.add(emotion);
      }
    }
    
    // If an emotion tag was provided, use it to influence the updates
    if (emotionTag) {
      switch(emotionTag.toLowerCase()) {
        case 'anxious':
          updatedState.anxiety = Math.min((updatedState.anxiety || 0) + 0.1, 1.0);
          updatedState.stress = Math.min((updatedState.stress || 0) + 0.1, 1.0);
          updatedEmotions.add('anxiety');
          updatedEmotions.add('stress');
          break;
        case 'mellow':
        case 'gentle':
          updatedState.stress = Math.max((updatedState.stress || 0) - 0.1, 0.0);
          updatedState.fatigue = Math.min((updatedState.fatigue || 0) + 0.05, 1.0);
          updatedEmotions.add('stress');
          updatedEmotions.add('fatigue');
          break;
        case 'overlyexcited':
        case 'playful/cheeky':
        case 'mischievous':
          updatedState.excitement = Math.min((updatedState.excitement || 0) + 0.1, 1.0);
          updatedState.joy = Math.min((updatedState.joy || 0) + 0.1, 1.0);
          updatedEmotions.add('excitement');
          updatedEmotions.add('joy');
          break;
        case 'dreamy':
        case 'wistful':
          updatedState.withdrawn = Math.min((updatedState.withdrawn || 0) + 0.1, 1.0);
          updatedEmotions.add('withdrawn');
          break;
        case 'vulnerable':
        case 'fragile':
        case 'melancholic':
        case 'tremble':
          updatedState.confidence = Math.max((updatedState.confidence || 0) - 0.1, 0.0);
          updatedEmotions.add('confidence');
          break;
        case 'firm':
        case 'commanding':
        case 'confident':
          updatedState.confidence = Math.min((updatedState.confidence || 0) + 0.1, 1.0);
          updatedEmotions.add('confidence');
          break;
        case 'flirty':
        case 'tender':
        case 'affectionate':
          if (updatedState.hope !== undefined) {
            updatedState.hope = Math.min((updatedState.hope || 0) + 0.1, 1.0);
            updatedEmotions.add('hope');
          }
          if (updatedState.gratitude !== undefined) {
            updatedState.gratitude = Math.min((updatedState.gratitude || 0) + 0.1, 1.0);
            updatedEmotions.add('gratitude');
          }
          break;
      }
    }
    
    // Apply decay to emotions not mentioned (reduce by 5%)
    for (const [emotion, score] of Object.entries(updatedState)) {
      if (emotion !== 'lastUpdated' && !updatedEmotions.has(emotion)) {
        updatedState[emotion] = Math.max(0, score * 0.95); // 5% decay
      }
    }
    
    // Update lastUpdated timestamp
    updatedState.lastUpdated = new Date().toISOString();
    
    // Save updated state to Firestore and add to emotion history
    try {
      const chatRef = db.collection('aichats').doc(userId);
      const chatDoc = await chatRef.get();
      
      // Create a copy of the updated state with a timestamp
      const stateWithTimestamp = {
        ...updatedState,
        timestamp: new Date().toISOString()
      };
      
      // Get existing emotion history or create a new array
      let emotionHistory = [];
      if (chatDoc.exists && chatDoc.data().emotionHistory) {
        emotionHistory = chatDoc.data().emotionHistory;
      }
      
      // Add the current state to the history
      emotionHistory.push(stateWithTimestamp);
      
      // Limit the history to the last 50 entries
      if (emotionHistory.length > 50) {
        emotionHistory = emotionHistory.slice(-50);
      }
      
      // Update Firestore with the current state and history
      await chatRef.update({
        emotionState: updatedState,
        emotionHistory: emotionHistory,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (saveError) {
      console.error('Error saving updated emotion state:', saveError);
      // Continue even if saving fails
    }
    
    return updatedState;
  } catch (error) {
    console.error('Error updating emotion state:', error);
    // Return the current state if there's an error
    return await getEmotionState(userId);
  }
}

/**
 * Generates an emotion-aware system prompt for OpenAI
 * @param {string} userId - The user ID
 * @param {string} basePrompt - The base system prompt
 * @returns {Promise<string>} - The emotion-aware system prompt
 */
async function getEmotionAwarePrompt(userId, basePrompt) {
  try {
    // Get current emotion state
    const emotionState = await getEmotionState(userId);
    
    // Create emotion context to append to the base prompt
    const emotionContext = `

IMPORTANT: I have information about the user's current emotional state:
${JSON.stringify(emotionState, null, 2)}

Adjust your response tone and content based on this emotional profile. For example:
- If fatigue is high, use shorter sentences and a calming tone
- If joy is high, match their positive energy
- If stress or anxiety is high, be reassuring and supportive
- If they're withdrawn, be gentle but encouraging
- If they're talkative, engage with their energy

This emotional profile has been built over time and represents the user's ongoing emotional patterns. Use it to provide a more personalized and emotionally intelligent response.`;
    
    // Combine base prompt with emotion context
    return basePrompt + emotionContext;
  } catch (error) {
    console.error('Error generating emotion-aware prompt:', error);
    // Return the original prompt if there's an error
    return basePrompt;
  }
}

module.exports = { getEmotionState, updateEmotionState, getEmotionAwarePrompt };