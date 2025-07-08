/**
 * Simple test script for the Generate API
 * 
 * This script demonstrates how to use the Generate API and verify that the chat ID is included in the response
 * Run with: node test-generate-api.js
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:8000/api/response';

// Helper function to make API requests
async function makeRequest(method, endpoint, data = null) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Test function for the generate API
async function testGenerateAPI() {
  console.log('\n--- Testing Generate API ---');
  try {
    const result = await makeRequest('POST', '/generate', {
      transcribedText: 'I am feeling good'
    });
    
    console.log('Generate API Response:');
    console.log('Success:', result.success);
    console.log('Chat ID:', result.id);
    console.log('Emotion Tag:', result.emotionTag);
    console.log('Voice ID:', result.voiceId);
    console.log('Response:', result.response);
    console.log('Audio Length:', result.audio ? result.audio.length : 'No audio');
    
    // Verify that the chat ID is included in the response
    if (result.id) {
      console.log('\n✅ Chat ID is included in the response!');
    } else {
      console.log('\n❌ Chat ID is NOT included in the response!');
    }
    
    return result;
  } catch (error) {
    console.error('Failed to test Generate API');
  }
}

// Main test function
async function runTests() {
  console.log('Starting Generate API test...');
  
  // Test the Generate API
  await testGenerateAPI();
  
  console.log('\nTests completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
});