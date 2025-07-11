const axios = require('axios');

const API_URL = 'http://localhost:8000';
const USER_ID = 'test-user-123';

async function testGenerateWithPreferences() {
  console.log('Testing preference extraction...');
  
  // Test food preferences
  try {
    const foodResponse = await axios.post(`${API_URL}/response/generate`, {
      userId: USER_ID,
      userText: 'I love sushi and salad, but I am allergic to perfumes used in mosque',
      isVoiceMessage: false
    });
    console.log('Food preferences message sent successfully');
  } catch (error) {
    console.error('Error sending food preferences message:', error.message);
  }
  
  // Test place preferences
  try {
    const placeResponse = await axios.post(`${API_URL}/response/generate`, {
      userId: USER_ID,
      userText: 'I enjoy going to clubs, temple and mosque',
      isVoiceMessage: false
    });
    console.log('Place preferences message sent successfully');
  } catch (error) {
    console.error('Error sending place preferences message:', error.message);
  }
  
  // Test activity preferences
  try {
    const activityResponse = await axios.post(`${API_URL}/response/generate`, {
      userId: USER_ID,
      userText: 'I really enjoy playing UNO cards',
      isVoiceMessage: false
    });
    console.log('Activity preferences message sent successfully');
  } catch (error) {
    console.error('Error sending activity preferences message:', error.message);
  }
  
  // Test weather preferences
  try {
    const weatherResponse = await axios.post(`${API_URL}/response/generate`, {
      userId: USER_ID,
      userText: 'I love rainy weather',
      isVoiceMessage: false
    });
    console.log('Weather preferences message sent successfully');
  } catch (error) {
    console.error('Error sending weather preferences message:', error.message);
  }
}

async function testGetPreferences() {
  console.log('\nTesting preferences retrieval...');
  
  try {
    const response = await axios.get(`${API_URL}/response/preferences?userId=${USER_ID}`);
    console.log('Retrieved preferences:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error retrieving preferences:', error.message);
  }
}

async function runTests() {
  await testGenerateWithPreferences();
  
  // Wait a bit for preferences to be processed
  console.log('\nWaiting for preferences to be processed...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await testGetPreferences();
}

runTests();