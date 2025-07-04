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
    // Get all chat documents
    const chatSnapshot = await db.collection('aichats').get();
    
    if (chatSnapshot.empty) {
      console.log('No chat documents found in Firestore.');
      return;
    }
    
    console.log(`Found ${chatSnapshot.size} chat documents.`);
    
    // Process each chat document
    for (const doc of chatSnapshot.docs) {
      const chatData = doc.data();
      const userId = chatData.user_id || doc.id;
      
      if (!chatData.chat || !Array.isArray(chatData.chat) || chatData.chat.length === 0) {
        console.log(`Skipping document ${doc.id}: No chat entries found.`);
        continue;
      }
      
      console.log(`Processing document ${doc.id} with ${chatData.chat.length} chat entries...`);
      
      let updatedCount = 0;
      let skippedCount = 0;
      
      // Process each chat entry
      for (let i = 0; i < chatData.chat.length; i++) {
        const entry = chatData.chat[i];
        
        // Skip entries that already have embeddings
        if (entry.embeddings) {
          skippedCount++;
          continue;
        }
        
        try {
          // Generate embeddings for the question
          const questionEmbeddings = await generateEmbeddings(entry.question);
          
          // Add embeddings to the chat entry
          chatData.chat[i].embeddings = questionEmbeddings;
          updatedCount++;
          
          // Log progress every 5 entries
          if (updatedCount % 5 === 0) {
            console.log(`Generated embeddings for ${updatedCount} entries so far...`);
          }
        } catch (error) {
          console.error(`Error generating embeddings for entry ${i}: ${error.message}`);
        }
      }
      
      // Update the document in Firestore
      if (updatedCount > 0) {
        await db.collection('aichats').doc(doc.id).update({
          chat: chatData.chat,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Updated document ${doc.id}: Added embeddings to ${updatedCount} entries, skipped ${skippedCount} entries.`);
      } else {
        console.log(`No updates needed for document ${doc.id}: All ${skippedCount} entries already have embeddings.`);
      }
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