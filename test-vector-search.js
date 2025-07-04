/**
 * Test script to demonstrate vector search functionality
 * 
 * This script shows how to:
 * 1. Generate embeddings for a text query
 * 2. Perform a semantic search on chat history
 */

require('dotenv').config();
const { semanticSearch, generateEmbeddings } = require('./backend/helpers/firestoreHelper');

// Test user ID (same as used in the application)
const TEST_USER_ID = 'test_user_id';

// Example search queries to test
const searchQueries = [
  'weather forecast',
  'movie recommendations',
  'coding help',
  'travel advice'
];

async function runTests() {
  console.log('===== VECTOR SEARCH TEST =====\n');
  
  // Test generating embeddings
  try {
    console.log('Testing embedding generation...');
    const testText = 'This is a test query for embedding generation';
    const embeddings = await generateEmbeddings(testText);
    
    console.log(`Successfully generated embeddings for: "${testText}"`); 
    console.log(`Embedding vector length: ${embeddings.length}`); 
    console.log(`First 5 values: ${embeddings.slice(0, 5).join(', ')}\n`);
  } catch (error) {
    console.error('Error generating embeddings:', error.message);
  }
  
  // Test semantic search
  for (const query of searchQueries) {
    try {
      console.log(`Searching for: "${query}"...`);
      const results = await semanticSearch(TEST_USER_ID, query, 3);
      
      console.log(`Found ${results.length} results:`);
      
      if (results.length === 0) {
        console.log('No matching results found.\n');
        continue;
      }
      
      // Display results with similarity scores
      results.forEach((result, index) => {
        console.log(`Result #${index + 1} (similarity: ${result.similarity.toFixed(4)})`);
        console.log(`Question: ${result.question}`);
        console.log(`Response: ${result.response.substring(0, 100)}...`);
        console.log('---');
      });
      
      console.log('');
    } catch (error) {
      console.error(`Error searching for "${query}": ${error.message}\n`);
    }
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
});