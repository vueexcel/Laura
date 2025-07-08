/**
 * Simple test script for the Moments API
 * 
 * This script demonstrates how to use the Moments API with the new data structure
 * Run with: node test-moments-api.js
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:8000/api/response';
const TEST_USER_ID = 'test_user_id'; // This should match the test user ID in your backend

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

// Test functions
async function testMigrateMoments() {
  console.log('\n--- Testing Migrate Moments ---');
  try {
    const result = await makeRequest('POST', '/moments/migrate');
    console.log('Migration result:', result);
    return result;
  } catch (error) {
    console.error('Failed to migrate moments');
  }
}

async function testGetAllMoments() {
  console.log('\n--- Testing Get All Moments ---');
  try {
    const result = await makeRequest('GET', '/moments');
    console.log(`Retrieved ${result.moments.length} moments`);
    
    // Display the first moment to check structure
    if (result.moments.length > 0) {
      console.log('First moment structure:');
      console.log(JSON.stringify(result.moments[0], null, 2));
    }
    
    return result;
  } catch (error) {
    console.error('Failed to get moments');
  }
}

async function testGetMomentsByLabel(label) {
  console.log(`\n--- Testing Get Moments by Label: ${label} ---`);
  try {
    const result = await makeRequest('GET', `/moments?label=${encodeURIComponent(label)}`);
    console.log(`Retrieved ${result.moments.length} moments with label "${label}"`);
    
    // Display the first moment to check structure
    if (result.moments.length > 0) {
      console.log('First moment structure:');
      console.log(JSON.stringify(result.moments[0], null, 2));
    }
    
    return result;
  } catch (error) {
    console.error(`Failed to get moments with label "${label}"`);
  }
}

// Main test function
async function runTests() {
  console.log('Starting Moments API tests...');
  
  // First, migrate any existing moments to the new format
  await testMigrateMoments();
  
  // Then test retrieving all moments
  await testGetAllMoments();
  
  // Test retrieving moments by label
  // Replace with a label that exists in your database
  await testGetMomentsByLabel('night');
  
  console.log('\nTests completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
});