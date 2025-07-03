const asyncHandler = require('express-async-handler');
const { transcribeAudio } = require('../helpers/transcriptionHelper');
const { generateResponse } = require('../helpers/responseHelper');
const { textToSpeech } = require('../helpers/audioHelper');
const fs = require('fs');
const path = require('path');

const transcribeVoice = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const allowedTypes = [
    'audio/flac', 'audio/m4a', 'audio/mp3', 'audio/mp4', 'audio/mpeg',
    'audio/mpga', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-wav', 'audio/x-m4a'
  ];

  if (!allowedTypes.includes(req.file.mimetype)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid file type' });
  }

  try {
    const transcription = await transcribeAudio(req.file.path);
    
    // Generate AI response from transcribed text
    const textResponse = await generateResponse(transcription);
    
    // Convert response to audio
    const audioBuffer = await textToSpeech(textResponse);

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    // Set response headers for JSON response
    res.setHeader('Content-Type', 'application/json');

    res.status(200).json({
      success: true,
      transcription: transcription,
      response: textResponse,
      audio: audioBuffer.toString('base64')
    });

  } catch (error) {
    // Clean up the uploaded file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Error in transcribeVoice:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process audio file',
      details: error.details,
      code: error.code
    });
  }
});

module.exports = { transcribeVoice };