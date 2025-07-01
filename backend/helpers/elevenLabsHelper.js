const fs = require('fs');
const path = require('path');
const axios = require('axios');
const emotionSettings = {
    neutral: {
        stability: 0.75,
        similarityBoost: 0.75,
        style: 0.5,
        useSpeakerBoost: true,
    },
    sad: {
        stability: 0.9,
        similarityBoost: 0.9,
        style: 0.1,       
        useSpeakerBoost: false
    },
    aww: {
        stability: 0.7,
        similarityBoost: 0.8,
        style: 0.4,
        useSpeakerBoost: true,
    },
    happy: {
        stability: 0.4,
        similarityBoost: 0.6,
        style: 0.85,
        useSpeakerBoost: true,
    },
    excited: {
        stability: 0.3,
        similarityBoost: 0.6,
        style: 0.9,
        useSpeakerBoost: true,
    },
    angry: {
        stability: 0.2,
        similarityBoost: 0.5,
        style: 0.8,
        useSpeakerBoost: true,
    },
};
// async function generateAndPlaySpeech(voiceId, text, emotion = 'neutral') {
//     try {
//         const voiceSettings = emotionSettings[emotion] || emotionSettings['neutral'];
//         const audio = await elevenlabs.textToSpeech.convert(voiceId, {
//             text,
//             modelId: 'eleven_multilingual_v2',
//             outputFormat: 'mp3_44100_128',
//             voiceSettings
//         });
//         const buffer = await streamToBuffer(audio);
//         const filePath = path.join(__dirname, 'speech.mp3');

//         fs.writeFileSync(filePath, buffer);
//         return buffer;
//         // return audio;
//         // await play(audio);
//     } catch (error) {
//         console.error('Error generating or playing speech:', error);
//         throw error;
//     }
// }


// async function streamToBuffer(stream) {
//     const reader = stream.getReader();
//     const chunks = [];

//     while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;
//         chunks.push(value);
//     }

//     return Buffer.concat(chunks);
// }



// async function generateAndPlaySpeech(voiceId, text, emotion = 'neutral') {
//     try {
//         const voiceSettings = emotionSettings[emotion] || emotionSettings['neutral'];
//         const apiKey = process.env.ELEVENLABS_API_KEY;
//         const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

//         const response = await axios.post(
//             url,
//             {
//                 text,
//                 model_id: 'eleven_flash_v2_5',
//                 outputFormat: 'mp3_22050_64',
//                 voice_settings: voiceSettings
//             },
//             {
//                 responseType: 'stream',
//                 headers: {
//                     'xi-api-key': apiKey,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );
//         return response.data;;
//     } catch (error) {
//         console.error('Error generating speech:', error.response?.data || error.message);
//         throw error;
//     }
// }

async function generateAndPlaySpeech(voiceId, text, emotion = 'neutral') {
    try {
        const voiceSettings = emotionSettings[emotion] || emotionSettings['neutral'];
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

        const response = await axios.post(
            url,
            {
                text,
                model_id: 'eleven_multilingual_v2', // You may switch to 'eleven_monolingual_v1' or 'eleven_turbo_v2' for better emotional control
                output_format: 'mp3_22050_64', // note: underscore key, not camelCase
                voice_settings: voiceSettings
            },
            {
                responseType: 'stream',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data; // This is a readable stream
    } catch (error) {
        console.error('Error generating speech:', error.response?.data || error.message);
        throw error;
    }
}





module.exports = {
    generateAndPlaySpeech,
};
