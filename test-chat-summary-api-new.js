const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Function to test the chat summary API
async function testChatSummaryAPI() {
    console.log('Testing chat summary API with new implementation...');
    const startTime = Date.now();
    
    try {
        // Send a request to the API
        const response = await axios.post('http://localhost:8001/api/response/generate', {
            transcribedText: 'Tell me about our previous conversations'
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer' // Important for receiving audio data
        });
        
        const endTime = Date.now();
        const responseTime = ((endTime - startTime) / 1000).toFixed(3);
        
        // Check if the response contains audio data
        const contentType = response.headers['content-type'];
        const isAudio = contentType && contentType.includes('audio');
        
        // Save the audio response to a file if it's audio
        let audioSaved = false;
        let fileSize = 0;
        
        if (isAudio) {
            const audioFilePath = path.join(__dirname, 'chat_summary_response_new.mp3');
            fs.writeFileSync(audioFilePath, response.data);
            audioSaved = true;
            fileSize = fs.statSync(audioFilePath).size;
        }
        
        // Write test results to a file
        const results = [
            `API Response Time: ${responseTime} seconds`,
            `Content-Type: ${contentType}`,
            audioSaved ? `Audio response saved to chat_summary_response_new.mp3` : 'No audio response received',
            fileSize > 0 ? `File size: ${fileSize} bytes` : ''
        ].join('\n');
        
        fs.writeFileSync('chat-summary-api-test-results-new.txt', results);
        console.log('Test completed successfully. Results written to chat-summary-api-test-results-new.txt');
        
    } catch (error) {
        console.error('Error testing API:', error.message);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        
        // Write error to the results file
        fs.writeFileSync('chat-summary-api-test-results-new.txt', `Error: ${error.message}\n${error.stack}`);
    }
}

// Run the test
testChatSummaryAPI();