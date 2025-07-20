/**
 * Script to add embeddings to existing chat entries in Firestore
 * 
 * This script will:
 * 1. Fetch all chat documents from Firestore
 * 2. For each chat entry without embeddings, generate and add them
 * 3. Update the documents in Firestore
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const { generateEmbeddings } = require('./backend/helpers/firestoreHelper');

// Initialize Firebase Admin SDK with service account
const serviceAccount = require(path.join(__dirname, './laura-b7cb2-firebase-adminsdk-fbsvc-6d6395e624.json'));

// Check if Firebase is already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Get Firestore instance
const db = admin.firestore();

async function addEmbeddingsToExistingChats() {
  console.log('===== ADDING EMBEDDINGS TO EXISTING CHAT ENTRIES =====\n');
  
  try {
    // Get all user documents to retrieve chatIds
    const userSnapshot = await db.collection('users').get();
    
    if (userSnapshot.empty) {
      console.log('No user documents found in Firestore.');
      return;
    }
    
    console.log(`Found ${userSnapshot.size} user documents.`);
    
    // Process each user document
    for (const userDoc of userSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userData.userId || userDoc.id;
      
      if (!userData.chatIds || !Array.isArray(userData.chatIds) || userData.chatIds.length === 0) {
        console.log(`Skipping user ${userId}: No chat IDs found.`);
        continue;
      }
      
      console.log(`Processing user ${userId} with ${userData.chatIds.length} chat entries...`);
      
      let updatedCount = 0;
      let skippedCount = 0;
      
      // Process each chat entry
      for (const chatId of userData.chatIds) {
        // Get the chat entry from the chatHistory collection
        const chatEntryRef = db.collection('chatHistory').doc(chatId);
        const chatEntryDoc = await chatEntryRef.get();
        
        if (!chatEntryDoc.exists) {
          console.log(`Skipping chat entry ${chatId}: Document not found.`);
          continue;
        }
        
        const chatEntry = chatEntryDoc.data();
        
        // Skip entries that already have embeddings
        if (chatEntry.embeddings) {
          skippedCount++;
          continue;
        }
        
        try {
          // Generate embeddings for the question
          const questionEmbeddings = await generateEmbeddings(chatEntry.question);
          
          // Update the chat entry with embeddings
          await chatEntryRef.update({
            embeddings: questionEmbeddings,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          updatedCount++;
          
          // Log progress every 5 entries
          if (updatedCount % 5 === 0) {
            console.log(`Generated embeddings for ${updatedCount} entries so far...`);
          }
        } catch (error) {
          console.error(`Error generating embeddings for chat entry ${chatId}: ${error.message}`);
        }
      }
      
      console.log(`Completed processing for user ${userId}: Added embeddings to ${updatedCount} entries, skipped ${skippedCount} entries.`);
    }
    
    console.log('\nFinished adding embeddings to existing chat entries.');
  } catch (error) {
    console.error('Error processing chat documents:', error);
  }
}

// Run the script
addEmbeddingsToExistingChats().catch(error => {
  console.error('Script failed:', error);
}).finally(() => {
  // Exit the process when done
  setTimeout(() => process.exit(0), 1000);
});