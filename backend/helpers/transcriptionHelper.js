const fs = require('fs');
require('dotenv').config();
const Groq = require('groq-sdk');

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY environment variable is not set');
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function transcribeAudio(audioData, format = 'm4a') { // Changed default format to m4a
  // Check if audioData is a file path (string) or a buffer
  let audio;
  let tempFilePath = null;

  try {
    if (typeof audioData === 'string') {
      // It's a file path
      if (!fs.existsSync(audioData)) {
        throw new Error(`File not found: ${audioData}`);
      }
      audio = fs.createReadStream(audioData);
    } else if (Buffer.isBuffer(audioData)) {
      // It's a buffer, create a temporary file
      const os = require('os');
      const path = require('path');
      tempFilePath = path.join(os.tmpdir(), `temp-audio-${Date.now()}.${format}`);

      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, audioData);
      audio = fs.createReadStream(tempFilePath);
    } else {
      throw new Error('Invalid audio data: must be a file path or a buffer');
    }
  } catch (error) {
    console.error('Error preparing audio data:', error);
    throw error;
  }

  let startTime;
  try {
    console.log('Making Groq API request...');
    startTime = Date.now(); // Record start time

    const response = await groq.audio.transcriptions.create({
      file: audio,
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json',
    });

    if (!response || !response.text) {
      console.warn('Empty or malformed response received from Groq API.');
      return "user is silence";
    }

    const endTime = Date.now(); // Record end time
    const transcriptionTime = (endTime - startTime) / 1000; // Calculate time in seconds

    console.log('Groq API Response:', response);
    console.log(`Transcription time: ${transcriptionTime} seconds`); // Log transcription time

    return response.text; // Groq SDK returns a JSON object, extract the text
  } catch (error) {
    console.error('Groq API Error:', error);
    // Return a user-friendly error message, preserving the error details for debugging.
    return `user is silence. (Details: ${error.message})`;
  } finally {
    if (audio) {
      audio.destroy(); // Clean up the stream
    }

    // Delete temporary file if one was created
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Deleted temporary file: ${tempFilePath}`);
      } catch (err) {
        console.error(`Error deleting temporary file: ${err.message}`);
      }
    }
  }
}

module.exports = { transcribeAudio };