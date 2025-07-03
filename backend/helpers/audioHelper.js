const axios = require('axios');
require('dotenv').config();

if (!process.env.labapiKey) {
    throw new Error('ElevenLabs API key is required but not found in environment variables');
}

async function validateText(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input: Text must be a non-empty string');
    }
    if (text.length > 5000) {
        throw new Error('Text length exceeds maximum limit of 5000 characters');
    }
}


async function textToSpeech(text) {
    await validateText(text);

    try {
        const response = await axios({
            method: 'post',
            url: 'https://api.elevenlabs.io/v1/text-to-speech/PT4nqlKZfc06VW1BuClj/stream?output_format=mp3_44100_128',
            headers: {
                'xi-api-key': process.env.labapiKey,
                'Content-Type': 'application/json'
            },
            data: {
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8
                }
            },
            responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error in text to speech conversion:', error.response?.data || error.message);
        throw new Error('Failed to convert text to speech: ' + (error.response?.data || error.message));
    }
}

module.exports = { textToSpeech };
