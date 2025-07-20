// Script to update the chat summary for a specific user
require('dotenv').config();
const admin = require('firebase-admin');
const { generateChatSummary, getChatHistoryForUser } = require('./helpers/firestoreHelper');

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
} catch (error) {
  console.log('Firebase admin already initialized or error:', error.message);
}

const db = admin.firestore();

// Function to update chat summary for a user
async function updateChatSummary(userId) {
  try {
    console.log(`Updating chat summary for user ${userId}...`);
    
    // Get ALL chat history from the last month
    const chatHistory = await getChatHistoryForUser(userId, 0);
    
    if (!chatHistory || chatHistory.length === 0) {
      console.log(`No chat history found for user ${userId}`);
      return;
    }
    
    console.log(`Found ${chatHistory.length} chat entries for user ${userId}`);
    
    // Generate a new chat summary
    const newChatSummary = await generateChatSummary(chatHistory);
    
    // Store the chat summary in the chatSummary collection
    const chatSummaryRef = db.collection('chatSummary').doc(userId);
    
    // Check if document exists
    const chatSummaryDoc = await chatSummaryRef.get();
    
    if (chatSummaryDoc.exists) {
      console.log(`Updating existing chat summary document for user ${userId}`);
      // Update existing document
      await chatSummaryRef.update({
        summary: newChatSummary,
        lastUpdated: new Date().toISOString()
      });
    } else {
      console.log(`Creating new chat summary document for user ${userId}`);
      // Create new document
      await chatSummaryRef.set({
        userId: userId,
        summary: newChatSummary,
        lastUpdated: new Date().toISOString()
      });
    }
    
    console.log(`Successfully updated chat summary for user ${userId}`);
    console.log('\nNew Chat Summary:');
    console.log('------------------------');
    console.log(newChatSummary);
    console.log('------------------------');
  } catch (error) {
    console.error('Error updating chat summary:', error);
  }
}

// Run the update function for the test user
const userId = 'test_user_id';
updateChatSummary(userId);