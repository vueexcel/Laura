// helpers/voiceHelper.js
const axios = require('axios');
const { OpenAI } = require('openai');

const emotionSettings = {
  neutral: { stability: 0.5, similarity_boost: 0.5 },
  excited: { stability: 0.7, similarity_boost: 0.3 },
  sad: { stability: 0.3, similarity_boost: 0.7 },
  mellow: { stability: 0.6, similarity_boost: 0.6 },
  anxious: { stability: 0.1, similarity_boost: 0.9 },
  regret: { stability: 0.2, similarity_boost: 0.9 },
};


let textBuffer = '';

function splitSentences(newTextChunk) {
  textBuffer += newTextChunk;

  const sentences = [];
  let match;

  // Improved regex: captures sentence ends
  const sentenceRegex = /(.+?[.!?])(\s|$)/g;

  while ((match = sentenceRegex.exec(textBuffer)) !== null) {
    const sentence = match[1].trim();
    if (sentence.length > 10) {
      sentences.push(sentence);
    }
  }

  // Remove matched portion from buffer (only if any sentence matched)
  if (sentences.length > 0) {
    const lastMatchEnd = sentenceRegex.lastIndex;
    textBuffer = textBuffer.slice(lastMatchEnd);
  }

  return sentences;
}

async function elevenlabsTTS(text, emotion = 'neutral') {
  if (!text || text.length < 8) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABSVOICEID}/stream`,
      {
        text,
        model_id: 'eleven_turbo_v2',
        output_format: 'mp3_22050_64',
        voice_settings: emotionSettings[emotion] || emotionSettings.neutral,
      },
      {
        responseType: 'stream',
        signal: controller.signal,
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    clearTimeout(timeout);
    return response.data;
  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ ElevenLabs Error:', error.message);
    return null;
  }
}

async function streamToClient(audioStream, res) {
  return new Promise((resolve, reject) => {
    audioStream.pipe(res, { end: false });
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
  });
}

async function streamGptToElevenLabsAudio(user_id, question, res) {
 const client = new OpenAI({ apiKey: process.env.OPENAIAPIKEY });

  const stream = await client.chat.completions.create({
    model: 'gpt-4-turbo',
    stream: true,
    messages: [
      { role: 'system', content: 'You are Laura...' },
      { role: 'user', content: question },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (!text) continue;

    const sentences = splitSentences(text);

    for (const sentence of sentences) {
      try {
        console.log("🔊 Speaking:", sentence);
        const audioStream = await elevenlabsTTS(sentence);
        await streamToClient(audioStream, res);
      } catch (err) {
        console.error("TTS error:", err.message);
      }
    }
  }

  // Final cleanup
  const finalSentence = textBuffer.trim();
  if (finalSentence && finalSentence.length > 10) {
    const audioStream = await elevenlabsTTS(finalSentence);
    await streamToClient(audioStream, res);
    textBuffer = '';
  }

  res.end();
}

module.exports = {
  streamGptToElevenLabsAudio,
};
