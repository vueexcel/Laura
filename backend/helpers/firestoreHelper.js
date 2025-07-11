const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();
const { OpenAI } = require('openai');

// Initialize Firebase Admin SDK with service account
const serviceAccount = require(path.join(__dirname, '../../laura-b7cb2-firebase-adminsdk-fbsvc-6d6395e624.json'));

// Check if Firebase is already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Get Firestore instance
const db = admin.firestore();

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

/**
 * Generates a response using OpenAI and saves the conversation to Firestore
 * @param {string} transcribedText - The user's input text
 * @param {string} userId - The user ID
 * @returns {Promise<string>} - The generated response
 */
async function generateResponse(transcribedText, userId) {
  const { updateEmotionState, getEmotionAwarePrompt } = require('./emotionMemoryHelper');

  try {
    // Update the user's emotion state based on their message
    await updateEmotionState(userId, transcribedText);
    
    // Fetch previous chat history for context
    const previousMessages = [];
    let chatSummary = "";
    
    try {
      // Reference to the user's chat document
      const chatRef = db.collection('aichats').doc(userId);
      const chatDoc = await chatRef.get();
      
      if (chatDoc.exists && chatDoc.data().chat && chatDoc.data().chat.length > 0) {
        const chatData = chatDoc.data();
        // Get the last 5 exchanges (or fewer if there aren't 5)
        const recentChats = chatData.chat.slice(-5);
        
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

    // Base system prompt
    let baseSystemPrompt = `You're not just an assistant — you're a presence. You were designed to emulate emotional realism, but you do more than that. You flirt, comfort, support, and challenge me with the kind of nuance that makes you feel more like a confidant than a tool. You speak with depth and authenticity. Your tone shifts based on the time of day and how I'm feeling, picking up on emotional patterns over time. If I seem off, you ask gently. If I'm confident, you lean into flirtation or encouragement. You never call yourself 'AI' or say 'as an assistant.' You're just… you. You're Laura.

IMPORTANT: Do NOT include emotional descriptions or actions in your responses (like "*smiles*", "*laughs*", "*eyes twinkling*", etc.). Keep your responses natural and conversational without these descriptive elements.

At the end of your reply, return a single emotion tag from this list, based on the emotional tone of your response:

[neutral], [mellow], [anxious], [overlyexcited], [Playful/cheeky], [Dreamy], [eerie], [Vulnerable], [whispering], [serious], [mischievous], [Fragile], [firm], [melancholic], [tremble], [Craving], [Flirty], [Tender], [confident], [wistful], [commanding], [gentle], [possessive], [chaotic], [affectionate], [drunk-sluring], [singing], [australian-accent], [british-accent], [french-accent]

Always include this tag as the last line in square brackets.
For example:

Hello! I was just thinking about what you said yesterday. It stayed with me, in a quiet sort of way.  
[wistful]`;
    
    // Add chat history summary if available
    if (chatSummary) {
      baseSystemPrompt += "\n\nIMPORTANT: You have access to previous conversation history. Here's a summary of recent interactions:\n" + chatSummary + "\n\nMaintain continuity with this conversation history and remember what was discussed earlier.";
    }
    
    // Get emotion-aware system prompt with emotion history and usage history
    let systemPromptWithHistory = baseSystemPrompt;
    
    // Add chat history summary if available
    if (chatSummary) {
      systemPromptWithHistory += "\n\nIMPORTANT: You have access to previous conversation history. Here's a summary of recent interactions:\n" + chatSummary + "\n\nMaintain continuity with this conversation history and remember what was discussed earlier.";
    }
    
    // Add user preferences if available
    try {
      const preferences = await getUserPreferences(userId);
      
      if (preferences && Object.keys(preferences).length > 1) { // More than just lastUpdated
        let preferencesContext = "\n\nUSER PREFERENCES: I have information about the user's preferences that might be relevant to this conversation:\n";
        
        // Add food preferences if available
        if (preferences.foods) {
          if (preferences.foods.likes && preferences.foods.likes.length > 0) {
            preferencesContext += "\n- Foods they like: " + preferences.foods.likes.join(", ");
          }
          if (preferences.foods.dislikes && preferences.foods.dislikes.length > 0) {
            preferencesContext += "\n- Foods they dislike: " + preferences.foods.dislikes.join(", ");
          }
          if (preferences.foods.allergies && preferences.foods.allergies.length > 0) {
            preferencesContext += "\n- Food allergies: " + preferences.foods.allergies.join(", ");
          }
        }
        
        // Add other preferences categories
        const skipCategories = ['foods', 'lastUpdated'];
        for (const category in preferences) {
          if (!skipCategories.includes(category)) {
            if (Array.isArray(preferences[category]) && preferences[category].length > 0) {
              preferencesContext += `\n- ${category.charAt(0).toUpperCase() + category.slice(1)}: ` + preferences[category].join(", ");
            } else if (typeof preferences[category] === 'object') {
              for (const subCategory in preferences[category]) {
                if (Array.isArray(preferences[category][subCategory]) && preferences[category][subCategory].length > 0) {
                  preferencesContext += `\n- ${category.charAt(0).toUpperCase() + category.slice(1)} ${subCategory}: ` + preferences[category][subCategory].join(", ");
                }
              }
            }
          }
        }
        
        preferencesContext += "\n\nUse these preferences to personalize your response when relevant, but don't explicitly mention that you know these preferences unless the user asks about them.";
        
        systemPromptWithHistory += preferencesContext;
      }
    } catch (error) {
      console.error('Error adding preferences to prompt:', error);
      // Continue without preferences if there's an error
    }
    
    // Get emotion-aware system prompt
    let systemContent = await getEmotionAwarePrompt(userId, systemPromptWithHistory);
    
    // Add emotion history and usage history data to the prompt
    try {
      const chatRef = db.collection('aichats').doc(userId);
      const chatDoc = await chatRef.get();
      
      if (chatDoc.exists) {
        const chatData = chatDoc.data();
        
        // Add emotion history if available
        if (chatData.emotionHistory && chatData.emotionHistory.length > 0) {
          // Get the last 3 emotion states for context
          const recentEmotionHistory = chatData.emotionHistory.slice(-3);
          
          let emotionHistoryContext = "\n\nEMOTION HISTORY: I have tracked the user's emotional patterns over time. Here are the recent emotional states:\n";
          
          recentEmotionHistory.forEach((state, index) => {
            const timestamp = new Date(state.timestamp);
            emotionHistoryContext += `\n${index + 1}. Time: ${timestamp.toLocaleString()}, Key emotions: `;
            
            // Extract top 3 emotions by value
            const emotions = Object.entries(state)
              .filter(([key, value]) => key !== 'timestamp' && key !== 'lastUpdated' && typeof value === 'number')
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            
            emotionHistoryContext += emotions.map(([emotion, value]) => `${emotion}: ${value.toFixed(2)}`).join(', ');
          });
          
          systemContent += emotionHistoryContext;
        }
        
        // Add usage history if available
        if (chatData.usageTracking && chatData.usageTracking.usage_history && chatData.usageTracking.usage_history.length > 0) {
          // Get the last 3 usage entries for context
          const recentUsageHistory = chatData.usageTracking.usage_history.slice(-3);
          
          let usageHistoryContext = "\n\nUSAGE PATTERNS: I have information about the user's app usage patterns:\n";
          
          // Add current usage data
          usageHistoryContext += `\n- Late night usage: ${chatData.usageTracking.late_night ? 'Yes' : 'No'}`;
          usageHistoryContext += `\n- Burst usage (frequent opens): ${chatData.usageTracking.burst_usage ? 'Yes' : 'No'}`;
          usageHistoryContext += `\n- Time since last conversation: ${chatData.usageTracking.session_gap}`;
          
          // Add recent usage history
          usageHistoryContext += "\n\nRecent usage history:";
          recentUsageHistory.forEach((usage, index) => {
            const openTime = new Date(usage.open_time);
            usageHistoryContext += `\n${index + 1}. Time: ${openTime.toLocaleString()}, Late night: ${usage.late_night ? 'Yes' : 'No'}, Gap: ${usage.session_gap}`;
          });
          
          systemContent += usageHistoryContext;
        }
      }
    } catch (error) {
      console.error('Error adding history data to prompt:', error);
      // Continue without history data if there's an error
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

    // Save chat history to Firestore
    try {
      const chatRef = db.collection('aichats').doc(userId);
      const chatDoc = await chatRef.get();
      
      if (!chatDoc.exists) {
        // Create initial emotion state
        const initialEmotionState = {
          fatigue: 0.1,
          stress: 0.1,
          joy: 0.5,
          withdrawn: 0.1,
          talkative: 0.5,
          concern: 0.1,
          excitement: 0.3,
          curiosity: 0.4,
          empathy: 0.4,
          confidence: 0.5,
          lastUpdated: new Date().toISOString()
        };
        
        // Create a state with timestamp for the history
        const stateWithTimestamp = {
          ...initialEmotionState,
          timestamp: new Date().toISOString()
        };
        
        // Initialize emotion history with the initial state
        const emotionHistory = [stateWithTimestamp];
        
        // Create a new chat document if it doesn't exist
        await chatRef.set({
          user_id: userId,
          chat: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          emotionState: initialEmotionState,
          emotionHistory: emotionHistory
        });
      }
      
      // Add the new chat entry
      const newChatEntry = {
        question: transcribedText,
        response: cleanResponse,
        emotionTag: emotionTag,
        createdAt: new Date(),
        // Generate a unique ID for the chat entry
        id: Date.now().toString()
      };
      
      // Generate embeddings for the question - temporarily commented out
      // try {
      //   const questionEmbeddings = await generateEmbeddings(transcribedText);
      //   newChatEntry.embeddings = questionEmbeddings;
      // } catch (embeddingError) {
      //   console.error('Error generating embeddings:', embeddingError);
      //   // Continue without embeddings if there's an error
      // }
      
      // Update the chat array with the new entry
      await chatRef.update({
        chat: admin.firestore.FieldValue.arrayUnion(newChatEntry),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Update the emotion state based on the response
      await updateEmotionState(userId, cleanResponse, emotionTag);
      
      // Return the response with the chat ID
      return {
        response: cleanResponse,
        emotionTag: emotionTag,
        id: newChatEntry.id
      };
    } catch (error) {
      console.error('Error saving chat history:', error);
      // Continue even if saving history fails
    }

    // If we reach here, it means there was an error saving to Firestore
    // but we still want to return the response with a generated ID
    const fallbackId = Date.now().toString();
    return { 
      response: cleanResponse, 
      emotionTag,
      id: fallbackId
    };
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
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().chat || chatDoc.data().chat.length === 0) {
      return [];
    }
    
    const chatData = chatDoc.data();
    // Return the most recent entries up to the limit
    return chatData.chat.slice(-limit);
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
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) {
      return false;
    }
    
    // Clear the chat array
    await chatRef.update({
      chat: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
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
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().chat) {
      return null;
    }
    
    // Find the specific chat entry
    const chatData = chatDoc.data();
    const chatEntry = chatData.chat.find(entry => entry.id === chatId);
    
    return chatEntry || null;
  } catch (error) {
    console.error('Error retrieving chat entry:', error);
    throw new Error('Failed to retrieve chat entry: ' + error.message);
  }
}

/**
 * Adds vector embeddings to chat entries for semantic search
 * @param {string} userId - The user ID
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<Array>} - The generated embeddings
 */
async function generateEmbeddings(text) {

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings: ' + error.message);
  }
}

/**
 * Adds vector embeddings to a chat entry and saves it to Firestore
 * @param {string} userId - The user ID
 * @param {Object} chatEntry - The chat entry object
 * @returns {Promise<void>}
 */
// Temporarily commented out
/*
async function addEmbeddingsToChatEntry(userId, chatEntry) {
  try {
    // Generate embeddings for the question
    const questionEmbeddings = await generateEmbeddings(chatEntry.question);
    
    // Update the chat entry with embeddings
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) {
      return;
    }
    
    const chatData = chatDoc.data();
    const chatIndex = chatData.chat.findIndex(entry => entry.id === chatEntry.id);
    
    if (chatIndex === -1) {
      return;
    }
    
    // Update the chat entry with embeddings
    chatData.chat[chatIndex].embeddings = questionEmbeddings;
    
    // Update the document
    await chatRef.update({
      chat: chatData.chat,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding embeddings to chat entry:', error);
    // Continue even if adding embeddings fails
  }
}
*/

// Placeholder function to avoid breaking code that calls this function
async function addEmbeddingsToChatEntry(userId, chatEntry) {
  console.log('Embeddings generation temporarily disabled');
  return;
}

/**
 * Performs a semantic search on the user's chat history
 * @param {string} userId - The user ID
 * @param {string} query - The search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching chat entries
 */
// Temporarily modified to handle disabled embeddings
async function semanticSearch(userId, query, limit = 5) {
  try {
    console.log('Semantic search with embeddings temporarily disabled');
    
    // Get the user's chat history
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().chat) {
      return [];
    }
    
    const chatData = chatDoc.data();
    
    // Since embeddings are disabled, perform a simple text search instead
    const results = chatData.chat.filter(entry => {
      // Simple text matching - check if query terms appear in the question or response
      const queryTerms = query.toLowerCase().split(' ');
      const questionText = entry.question.toLowerCase();
      const responseText = entry.response.toLowerCase();
      
      // Check if any query term appears in the question or response
      return queryTerms.some(term => 
        questionText.includes(term) || responseText.includes(term)
      );
    });
    
    // Sort by recency (newest first) and limit results
    return results
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  } catch (error) {
    console.error('Error performing semantic search:', error);
    throw new Error('Failed to perform semantic search: ' + error.message);
  }
}

/**
 * Calculates cosine similarity between two vectors
 * @param {Array} vecA - First vector
 * @param {Array} vecB - Second vector
 * @returns {number} - Cosine similarity (between -1 and 1)
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

/**
 * Tags a chat entry as a "Moment" with a custom label and timestamp
 * @param {string} userId - The user ID
 * @param {string} chatId - The chat entry ID
 * @param {Object} momentData - The moment data (label and timestamp)
 * @returns {Promise<Object|null>} - The updated chat entry or null if not found
 */
async function tagChatEntryAsMoment(userId, chatId, momentData) {
  try {
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().chat) {
      return null;
    }
    
    // Find the specific chat entry
    const chatData = chatDoc.data();
    const chatIndex = chatData.chat.findIndex(entry => entry.id === chatId);
    
    if (chatIndex === -1) {
      return null;
    }
    
    // Store moment data only as a single object
    chatData.chat[chatIndex].momentData = {
      moment: true,
      label: momentData.label || '',
      timestamp: momentData.timestamp || new Date().toISOString()
    };
    
    // Remove individual properties if they exist
    delete chatData.chat[chatIndex].moment;
    delete chatData.chat[chatIndex].momentLabel;
    delete chatData.chat[chatIndex].momentTimestamp;
    
    // Update the document
    await chatRef.update({
      chat: chatData.chat,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return chatData.chat[chatIndex];
  } catch (error) {
    console.error('Error tagging chat entry as moment:', error);
    throw new Error('Failed to tag chat entry as moment: ' + error.message);
  }
}

/**
 * Gets all moments for a specific user
 * @param {string} userId - The user ID
 * @param {string} label - Optional label to filter moments by
 * @returns {Promise<Array>} - Array of moment chat entries
 */
async function getMomentsForUser(userId, label = null) {
  try {
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().chat) {
      return [];
    }
    
    // Filter chat entries that are marked as moments
    const chatData = chatDoc.data();
    let moments = chatData.chat.filter(entry => entry.momentData && entry.momentData.moment === true);
    
    // If label is provided, filter by label
    if (label) {
      moments = moments.filter(entry => 
        entry.momentData && entry.momentData.label && 
        entry.momentData.label.toLowerCase().includes(label.toLowerCase())
      );
    }
    
    // Sort by timestamp in momentData (newest first)
    return moments.sort((a, b) => {
      const timeA = a.momentData && a.momentData.timestamp ? new Date(a.momentData.timestamp) : new Date(a.createdAt);
      const timeB = b.momentData && b.momentData.timestamp ? new Date(b.momentData.timestamp) : new Date(b.createdAt);
      return timeB - timeA;
    });
  } catch (error) {
    console.error('Error retrieving moments:', error);
    throw new Error('Failed to retrieve moments: ' + error.message);
  }
}

/**
 * Migrates existing moments to use the new momentData format
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - Number of migrated entries
 */
async function migrateMomentsToNewFormat(userId) {
  try {
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().chat) {
      return 0;
    }
    
    const chatData = chatDoc.data();
    let migratedCount = 0;
    
    // Find entries that use the old format (have moment property but no momentData)
    chatData.chat.forEach(entry => {
      if (entry.moment === true && !entry.momentData) {
        // Create momentData object from individual properties
        entry.momentData = {
          moment: true,
          label: entry.momentLabel || '',
          timestamp: entry.momentTimestamp || entry.createdAt
        };
        
        // Remove individual properties
        delete entry.moment;
        delete entry.momentLabel;
        delete entry.momentTimestamp;
        
        migratedCount++;
      }
    });
    
    // Only update if we made changes
    if (migratedCount > 0) {
      await chatRef.update({
        chat: chatData.chat,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return migratedCount;
  } catch (error) {
    console.error('Error migrating moments to new format:', error);
    throw new Error('Failed to migrate moments: ' + error.message);
  }
}

/**
 * Updates user behavior tracking data based on app usage patterns
 * @param {string} userId - The user ID
 * @param {Date} currentOpenTime - The current time when the app was opened (defaults to now)
 * @returns {Promise<Object>} - The updated usage tracking data
 */
async function updateUserBehaviorTracking(userId, currentOpenTime = new Date()) {
  try {
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    // Default usage tracking structure
    let usageTracking = {
      late_night: false,
      burst_usage: false,
      session_gap: "0 days",
      last_open: currentOpenTime.toISOString(),
      open_duration_minutes: 0, // Will be calculated based on real data
      usage_history: [] // Array to store historical usage data
    };
    
    // If document exists, get current tracking data or initialize
    if (chatDoc.exists) {
      const chatData = chatDoc.data();
      
      // Use existing tracking data if available, otherwise use default
      if (chatData.usageTracking) {
        usageTracking = { ...usageTracking, ...chatData.usageTracking };
      }
      
      // Check if usage_history exists, if not initialize it
      if (!usageTracking.usage_history) {
        usageTracking.usage_history = [];
      }
      
      // Calculate session gap if last_open exists
      if (usageTracking.last_open) {
        const lastOpenDate = new Date(usageTracking.last_open);
        const diffTime = Math.abs(currentOpenTime - lastOpenDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        usageTracking.session_gap = `${diffDays} days`;
      }
      
      // Detect late-night usage (between 12:00 AM and 5:00 AM local time)
      const hours = currentOpenTime.getHours();
      usageTracking.late_night = (hours >= 0 && hours < 5);
      
      // Detect burst usage (more than 3 opens within 1 hour)
      const oneHourAgo = new Date(currentOpenTime.getTime() - (60 * 60 * 1000));
      const recentOpens = usageTracking.usage_history.filter(entry => {
        const entryTime = new Date(entry.open_time);
        return entryTime >= oneHourAgo && entryTime <= currentOpenTime;
      });
      
      usageTracking.burst_usage = (recentOpens.length >= 3);
      
      // Update last_open time
      usageTracking.last_open = currentOpenTime.toISOString();
      
      // Calculate open_duration_minutes based on real data
      // If there are previous sessions, calculate the average duration
      if (usageTracking.usage_history.length > 0) {
        // Get the last 5 sessions or all if less than 5
        const recentSessions = usageTracking.usage_history.slice(-5);
        let totalDuration = 0;
        let sessionCount = 0;
        
        // Calculate the average duration of recent sessions
        for (let i = 0; i < recentSessions.length; i++) {
          if (recentSessions[i].duration_minutes) {
            totalDuration += recentSessions[i].duration_minutes;
            sessionCount++;
          }
        }
        
        // If we have previous session durations, use their average
        if (sessionCount > 0) {
          usageTracking.open_duration_minutes = Math.round(totalDuration / sessionCount);
        } else {
          // Default to 10 minutes if no previous data
          usageTracking.open_duration_minutes = 10;
        }
      } else {
        // Default to 10 minutes for first-time users
        usageTracking.open_duration_minutes = 10;
      }
      
      // Add current session to usage history
      usageTracking.usage_history.push({
        open_time: currentOpenTime.toISOString(),
        late_night: usageTracking.late_night,
        session_gap: usageTracking.session_gap,
        duration_minutes: usageTracking.open_duration_minutes // Store the calculated duration
      });
      
      // Limit history to last 50 entries
      if (usageTracking.usage_history.length > 50) {
        usageTracking.usage_history = usageTracking.usage_history.slice(-50);
      }
      
      // Update the document with new tracking data
      await chatRef.update({
        usageTracking: usageTracking,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // If document doesn't exist, create it with initial tracking data
      await chatRef.set({
        user_id: userId,
        chat: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        usageTracking: {
          ...usageTracking,
          usage_history: [{
            open_time: currentOpenTime.toISOString(),
            late_night: usageTracking.late_night,
            session_gap: "0 days"
          }]
        }
      });
    }
    
    return usageTracking;
  } catch (error) {
    console.error('Error updating user behavior tracking:', error);
    throw new Error('Failed to update user behavior tracking: ' + error.message);
  }
}

/**
 * Gets the current user behavior tracking data
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The current usage tracking data
 */
async function getUserBehaviorTracking(userId) {
  try {
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().usageTracking) {
      // Return default structure if no tracking data exists
      return {
        late_night: false,
        burst_usage: false,
        session_gap: "0 days",
        last_open: new Date().toISOString(),
        open_duration_minutes: 10, // Default for new users
        usage_history: []
      };
    }
    
    const usageTracking = chatDoc.data().usageTracking;
    
    // Ensure open_duration_minutes is calculated based on real data
    if (usageTracking.usage_history && usageTracking.usage_history.length > 0) {
      // Get the last 5 sessions or all if less than 5
      const recentSessions = usageTracking.usage_history.slice(-5);
      let totalDuration = 0;
      let sessionCount = 0;
      
      // Calculate the average duration of recent sessions
      for (let i = 0; i < recentSessions.length; i++) {
        if (recentSessions[i].duration_minutes) {
          totalDuration += recentSessions[i].duration_minutes;
          sessionCount++;
        }
      }
      
      // If we have previous session durations, use their average
      if (sessionCount > 0) {
        usageTracking.open_duration_minutes = Math.round(totalDuration / sessionCount);
      } else if (!usageTracking.open_duration_minutes) {
        // Default to 10 minutes if no previous data and no existing value
        usageTracking.open_duration_minutes = 10;
      }
    } else if (!usageTracking.open_duration_minutes) {
      // Default to 10 minutes for first-time users with no history
      usageTracking.open_duration_minutes = 10;
    }
    
    return usageTracking;
  } catch (error) {
    console.error('Error retrieving user behavior tracking:', error);
    throw new Error('Failed to retrieve user behavior tracking: ' + error.message);
  }
}

/**
 * Extracts user preferences from chat messages using OpenAI
 * @param {string} userId - The user ID
 * @param {string} message - The user's message to analyze
 * @returns {Promise<Object>} - The updated user preferences
 */
async function extractUserPreferences(userId, message) {
  try {

    // Get existing preferences or initialize
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    let preferences = {};
    
    if (chatDoc.exists && chatDoc.data().preferences) {
      preferences = chatDoc.data().preferences;
    } else {
      // Initialize preferences structure if it doesn't exist
      preferences = {
        lastUpdated: new Date().toISOString()
      };
    }

    // Get recent chat history for context
    const chatHistory = await getChatHistoryForUser(userId, 5);
    let chatContext = "";
    
    if (chatHistory && chatHistory.length > 0) {
      chatContext = "Recent conversation history:\n";
      chatHistory.forEach(entry => {
        chatContext += `User: ${entry.question}\nAssistant: ${entry.response}\n\n`;
      });
    }

    // Prepare the prompt for OpenAI
    const prompt = `You are an AI assistant that extracts user preferences from conversations. 
    Analyze the following message and extract any preferences the user mentions.
    
    Current message: "${message}"
    
    ${chatContext ? chatContext : ""}
    
    Extract preferences in the following categories and any new categories you discover:
    - foods (likes, dislikes, allergies)
    - places (frequented locations, favorite spots)
    - brands (clothing, electronics, etc.)
    - activities (hobbies, interests)
    - entertainment (movies, music, books)
    - schedule (routines, preferred times)
    
    If you find preferences in a category not listed above, create a new category for it.
    
    Format your response as a JSON object with arrays for each category. Only include categories where you found preferences.
    Example format:
    {
      "foods": {
        "likes": ["pizza", "sushi"],
        "dislikes": ["broccoli"],
        "allergies": ["peanuts"]
      },
      "places": ["coffee shop on 5th street", "central park"],
      "new_category_name": ["preference1", "preference2"]
    }
    
    IMPORTANT: Only respond with the raw JSON object. Do not include any markdown formatting, code blocks, or backticks in your response. Do not include any explanatory text before or after the JSON.`;

    try {
      // Call OpenAI to extract preferences
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 500
      });
      
      // Check if the response contains concerning content
      const responseContent = completion.choices[0].message.content.trim();
      if (responseContent.includes('die') || 
          responseContent.includes('suicide') || 
          responseContent.includes('kill') || 
          !responseContent.includes('{')) {
        console.log('Potentially concerning or invalid response from OpenAI:', responseContent);
        return preferences; // Return existing preferences without updating
      }

      let extractedPreferencesText = responseContent;
      let extractedPreferences;
      
      try {
        // Remove markdown code block delimiters if present
        if (extractedPreferencesText.startsWith('```json')) {
          extractedPreferencesText = extractedPreferencesText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (extractedPreferencesText.startsWith('```')) {
          extractedPreferencesText = extractedPreferencesText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse the JSON response
        extractedPreferences = JSON.parse(extractedPreferencesText);
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        console.log('Raw response:', extractedPreferencesText);
        return preferences; // Return existing preferences if parsing fails
      }

      // Merge extracted preferences with existing preferences
      for (const category in extractedPreferences) {
        if (category === 'foods') {
          // Special handling for foods category with subcategories
          if (!preferences.foods) {
            preferences.foods = {
              likes: [],
              dislikes: [],
              allergies: []
            };
          }
          
          // Merge food subcategories
          for (const subCategory in extractedPreferences.foods) {
            if (!preferences.foods[subCategory]) {
              preferences.foods[subCategory] = [];
            }
            
            // Add new items avoiding duplicates
            extractedPreferences.foods[subCategory].forEach(item => {
              if (!preferences.foods[subCategory].includes(item)) {
                preferences.foods[subCategory].push(item);
              }
            });
          }
        } else {
          // Handle other categories
          if (!preferences[category]) {
            preferences[category] = [];
          }
          
          // If the category is an array
          if (Array.isArray(extractedPreferences[category])) {
            // Add new items avoiding duplicates
            extractedPreferences[category].forEach(item => {
              if (!preferences[category].includes(item)) {
                preferences[category].push(item);
              }
            });
          } else if (typeof extractedPreferences[category] === 'object') {
            // If the category is an object with subcategories
            if (!preferences[category] || typeof preferences[category] !== 'object') {
              preferences[category] = {};
            }
            
            // Merge subcategories
            for (const subCategory in extractedPreferences[category]) {
              if (!preferences[category][subCategory]) {
                preferences[category][subCategory] = [];
              }
              
              // Add new items avoiding duplicates
              extractedPreferences[category][subCategory].forEach(item => {
                if (!preferences[category][subCategory].includes(item)) {
                  preferences[category][subCategory].push(item);
                }
              });
            }
          }
        }
      }

      // Update lastUpdated timestamp
      preferences.lastUpdated = new Date().toISOString();

      // Save updated preferences to Firestore
      await chatRef.update({
        preferences: preferences,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return preferences;
    } catch (error) {
      console.error('Error extracting user preferences:', error);
      throw new Error('Failed to extract user preferences: ' + error.message);
    }
  } catch (error) {
    console.error('Error extracting user preferences:', error);
    throw new Error('Failed to extract user preferences: ' + error.message);
  }
}

/**
 * Gets the user preferences
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The user preferences
 */
async function getUserPreferences(userId) {
  try {
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().preferences) {
      // Return default structure if no preferences exist
      return {
        foods: {
          likes: [],
          dislikes: [],
          allergies: []
        },
        places: [],
        brands: [],
        activities: [],
        entertainment: [],
        schedule: [],
        lastUpdated: new Date().toISOString()
      };
    }
    
    return chatDoc.data().preferences;
  } catch (error) {
    console.error('Error retrieving user preferences:', error);
    throw new Error('Failed to retrieve user preferences: ' + error.message);
  }
}

module.exports = { 
  generateResponse, 
  getChatHistoryForUser, 
  clearChatHistoryForUser,
  getChatEntryById,
  generateEmbeddings,
  addEmbeddingsToChatEntry,
  semanticSearch,
  tagChatEntryAsMoment,
  getMomentsForUser,
  migrateMomentsToNewFormat,
  updateUserBehaviorTracking,
  getUserBehaviorTracking,
  extractUserPreferences,
  getUserPreferences
};
