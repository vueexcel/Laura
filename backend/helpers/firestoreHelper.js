const admin = require('firebase-admin');
const path = require('path');

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
  const { OpenAI } = require('openai');
  require('dotenv').config();

  if (!process.env.apiKey) {
    throw new Error('OpenAI API key is required but not found in environment variables');
  }

  const openai = new OpenAI({
    apiKey: process.env.apiKey
  });

  try {
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

    // Save chat history to Firestore
    try {
      const chatRef = db.collection('aichats').doc(userId);
      const chatDoc = await chatRef.get();
      
      if (!chatDoc.exists) {
        // Create a new chat document if it doesn't exist
        await chatRef.set({
          user_id: userId,
          chat: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Add the new chat entry
      const newChatEntry = {
        question: transcribedText,
        response: response,
        createdAt: new Date(),
        // Generate a unique ID for the chat entry
        id: Date.now().toString()
      };
      
      // Generate embeddings for the question
      try {
        const questionEmbeddings = await generateEmbeddings(transcribedText);
        newChatEntry.embeddings = questionEmbeddings;
      } catch (embeddingError) {
        console.error('Error generating embeddings:', embeddingError);
        // Continue without embeddings if there's an error
      }
      
      // Update the chat array with the new entry
      await chatRef.update({
        chat: admin.firestore.FieldValue.arrayUnion(newChatEntry),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
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
  const { OpenAI } = require('openai');
  require('dotenv').config();

  if (!process.env.apiKey) {
    throw new Error('OpenAI API key is required but not found in environment variables');
  }

  const openai = new OpenAI({
    apiKey: process.env.apiKey
  });

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

/**
 * Performs a semantic search on the user's chat history
 * @param {string} userId - The user ID
 * @param {string} query - The search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching chat entries
 */
async function semanticSearch(userId, query, limit = 5) {
  try {
    // Generate embeddings for the query
    const queryEmbeddings = await generateEmbeddings(query);
    
    // Get the user's chat history
    const chatRef = db.collection('aichats').doc(userId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists || !chatDoc.data().chat) {
      return [];
    }
    
    const chatData = chatDoc.data();
    
    // Filter chat entries that have embeddings
    const entriesWithEmbeddings = chatData.chat.filter(entry => entry.embeddings);
    
    if (entriesWithEmbeddings.length === 0) {
      return [];
    }
    
    // Calculate cosine similarity between query and each chat entry
    const results = entriesWithEmbeddings.map(entry => {
      const similarity = calculateCosineSimilarity(queryEmbeddings, entry.embeddings);
      return { ...entry, similarity };
    });
    
    // Sort by similarity (highest first) and limit results
    return results
      .sort((a, b) => b.similarity - a.similarity)
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

module.exports = { 
  generateResponse, 
  getChatHistoryForUser, 
  clearChatHistoryForUser,
  getChatEntryById,
  generateEmbeddings,
  addEmbeddingsToChatEntry,
  semanticSearch
};