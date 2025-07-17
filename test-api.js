const fetch = require('node-fetch');
const fs = require('fs');

async function testApi() {
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:8001/api/response/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcribedText: 'I am feeling a bit sad'
      })
    });
    
    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;
    
    let results = `Response Time: ${responseTime} seconds\n`;
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // Check if the response is audio
    const contentType = response.headers.get('content-type');
    results += `Content-Type: ${contentType}\n`;
    
    // Save the audio response to a file
    const buffer = await response.buffer();
    fs.writeFileSync('audio_response.mp3', buffer);
    
    results += `Audio response saved to audio_response.mp3\n`;
    results += `File size: ${buffer.length} bytes\n`;
    
    // Write results to file
    fs.writeFileSync('test-results.txt', results);
    
    console.log('Test completed. Results written to test-results.txt');
  } catch (error) {
    console.error('Error testing API:', error);
    fs.writeFileSync('test-results.txt', `Error: ${error.message}`);
  }
}

testApi();