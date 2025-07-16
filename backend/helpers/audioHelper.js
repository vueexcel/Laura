const axios = require('axios');
require('dotenv').config();

if (!process.env.labapiKey) {
    throw new Error('ElevenLabs API key is required but not found in environment variables');
}

// Voice ID mapping for different emotions
const voiceIdMap = {
    'neutral': 'OHIUUjUfuKZcYRQX2S7b',
    'mellow': 'w57HpPD5nasRV9ph6ReZ',
    'anxious': 'JFuK9m59iHICo2i9sLEe',
    'overlyexcited': 't5bEKgvrOSaDNB5tnupS',
    'playful/cheeky': 'OHIUUjUfuKZcYRQX2S7b', // Default to neutral as no ID provided
    'dreamy': 'eokRvjNFHIVTv7FPeJ2q',
    'eerie': 'xERo0pXt2kHuzLPytfcn',
    'vulnerable': 'sPXBGSlAUyWainCziBKL',
    'whispering': '20U1b0ROuetSqJPzhcZI',
    'serious': 'q0gs7zFp82NzkD4TX84v',
    'mischievous': 'SS3vic5Vij8J5Q0KXiP6',
    'fragile': 'EEIP19MZXx5dWxUJkYby',
    'firm': 'WjgtA9TX72sImi0fLDEP',
    'melancholic': 'SVH0RTtgOZZQLKErEfo8',
    'tremble': 'XpQA023FwecmnepnTgZP',
    'craving': 'WzjRfTXoTe2CtLbt3fri',
    'flirty': 'QVOIiH1awNORr4KkDmJb',
    'tender': 'DZFjiTwNRliN80j2LdP1',
    'confident': '6VRwaQkeV5Y0dHGREjKl',
    'wistful': 'Sbz2cqXBBPzvzYydeTYl',
    'commanding': 'uOPJ4ssK8DNgvL1YYap4',
    'gentle': 'KaqFYhsHKkmZFqkEMIX9',
    'possessive': 'qKo6KEAzEkk5KMMh6SxG',
    'chaotic': 'Aua3lFByBKfRAa3xH3a8',
    'affectionate': 'p6AgZiktlJFy7s3YXGud',
    'drunk-sluring': 'OHIUUjUfuKZcYRQX2S7b', // Default to neutral as no ID provided
    'singing': 'OHIUUjUfuKZcYRQX2S7b', // Default to neutral as no ID provided
    'australian-accent': 'lshmJ61yJqLgJb7lDgZB',
    'british-accent': 'OHIUUjUfuKZcYRQX2S7b', // Default to neutral as no ID provided
    'french-accent': 'OHIUUjUfuKZcYRQX2S7b' // Default to neutral as no ID provided
};

/**
 * Get voice ID from emotion tag
 * @param {string} emotionTag - The emotion tag (without brackets)
 * @returns {string} - The corresponding voice ID or default neutral ID
 */
function getVoiceIdFromEmotionTag(emotionTag) {
    // Convert to lowercase for case-insensitive matching
    const tag = emotionTag.toLowerCase().trim();
    return voiceIdMap[tag] || voiceIdMap['neutral']; // Default to neutral if not found
}

async function validateText(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input: Text must be a non-empty string');
    }
    if (text.length > 5000) {
        throw new Error('Text length exceeds maximum limit of 5000 characters');
    }
}

async function textToSpeech(text, voiceId = voiceIdMap['neutral']) {
    await validateText(text);

    try {
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
            headers: {
                'xi-api-key': process.env.labapiKey,
                'Content-Type': 'application/json'
            },
            data: {
                text: text,
                model_id: 'eleven_flash_v2_5',
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

module.exports = { textToSpeech, getVoiceIdFromEmotionTag };
