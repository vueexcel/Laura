const axios = require('axios');

async function testComfortAPI() {
    try {
        console.log('Testing /api/voice/comfort endpoint...');
        
        const response = await axios.post('http://localhost:8000/api/voice/comfort', {
            text: "I'm feeling anxious about my presentation tomorrow."
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('API Response Status:', response.status);
        console.log('Success:', response.data.success);
        console.log('Emotion Tag:', response.data.emotionTag);
        console.log('Voice ID:', response.data.voiceId);
        console.log('Chat ID:', response.data.id);
        console.log('Response Text:', response.data.response);
        console.log('Audio received:', response.data.audio ? 'Yes (base64 encoded)' : 'No');
        
        console.log('\nTest completed successfully!');
    } catch (error) {
        console.error('Error testing comfort API:', error.response?.data || error.message);
    }
}

testComfortAPI();