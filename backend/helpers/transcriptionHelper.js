const { OpenAI } = require('openai');
const fs = require('fs');
require('dotenv').config();

if (!process.env.apiKey) {
  throw new Error('apiKey environment variable is not set');
}

const openai = new OpenAI({ apiKey: process.env.apiKey });

async function transcribeAudio(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const audio = fs.createReadStream(filePath);

  try {
    console.log('Making OpenAI API request...');
    const response = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      response_format: 'text',
    });

    if (!response) {
      throw new Error('No response received from OpenAI API');
    }

    console.log('OpenAI API Response:', response);
    return response; // OpenAI SDK returns the text directly when response_format is 'text'
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  } finally {
    audio.destroy(); // Clean up the stream
  }
}

module.exports = { transcribeAudio };