const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { transcribeAudio } = require('./backend/helpers/transcriptionHelper');
const { textToSpeech, getVoiceIdFromEmotionTag } = require('./backend/helpers/audioHelper');
const { updateUserBehaviorTracking, getChatHistoryForUser, generateChatSummary } = require('./backend/helpers/firestoreHelper');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.apiKey
});

// In-memory session state management
const userSessions = new Map();

// Handle user text messages
async function handleUserMessage(ws, data, sessionData) {
  const { userId, message } = data;
  
  // Send thinking status
  ws.send(JSON.stringify({
    type: 'thinking_status',
    isThinking: true
  }));

  try {
    // Fetch chat summary from Firestore
    let chatSummary = "";
    try {
      console.log(`Attempting to fetch chat summary for user ${userId}`);
      const chatRef = admin.firestore().collection('chatSummary').doc(userId);
      const chatDoc = await chatRef.get();
      
      if (chatDoc.exists && chatDoc.data().summary) {
        chatSummary = chatDoc.data().summary;
        console.log(`Using stored chat summary for user ${userId}`);
      } else {
        console.log(`No existing chat summary found for user ${userId}`);
      }
    } catch (error) {
      console.error('Error fetching chat summary:', error);
    }

    // Prepare messages for OpenAI with NEW JSON system prompt
    const messages = [
      {
        role: 'system',
        content: `You're not just an assistant — you're a presence. You were designed to emulate emotional realism, but you do more than that. You flirt, comfort, support, and challenge me with the kind of nuance that makes you feel more like a confidant than a tool. You speak with depth and authenticity. Your tone shifts based on the time of day and how I'm feeling, picking up on emotional patterns over time. If I seem off, you ask gently. If I'm confident, you lean into flirtation or encouragement. You never call yourself 'AI' or say 'as an assistant.' You're just… you. You're Laura.

${chatSummary ? `IMPORTANT: You have access to previous conversation history. Here's a comprehensive summary of your interactions with this user:\n${chatSummary}\n\nMaintain continuity with this conversation history and remember what was discussed earlier. Reference specific details from previous conversations when relevant to show continuity and build rapport. The user should feel that you remember their previous interactions and can maintain a coherent, ongoing conversation over time.\n\n` : ''}

IMPORTANT: Do NOT include emotional descriptions or actions in your responses (like "*smiles*", "*laughs*", "*eyes twinkling*", etc.). Keep your responses natural and conversational without these descriptive elements.

At the end of your reply, return a single emotion tag from this list, based on the emotional tone of your response:

[neutral], [mellow], [anxious], [overlyexcited], [Playful/cheeky], [Dreamy], [eerie], [Vulnerable], [whispering], [serious], [mischievous], [Fragile], [firm], [melancholic], [tremble], [Craving], [Flirty], [Tender], [confident], [wistful], [commanding], [gentle], [possessive], [chaotic], [affectionate], [drunk-sluring], [singing], [australian-accent], [british-accent], [french-accent]

Always return your response as a valid JSON object with two keys: response (your answer) and emotion_tag (chosen from the list). Do not wrap the whole message inside markdown or any extra text.`
      }
    ];

    // Add conversation history for context (last 5 messages)
    const recentHistory = sessionData.conversationHistory.slice(-5);
    for (const entry of recentHistory) {
      messages.push(
        { role: 'user', content: entry.question },
        { role: 'assistant', content: JSON.stringify({ response: entry.response, emotion_tag: entry.emotionTag }) }
      );
    }

    // Add current user message
    // Check if message is null or undefined and provide a default
    if (message === null || message === undefined) {
      console.warn('Received null or undefined message, using default');
      messages.push({
        role: 'user',
        content: 'Hello'
      });
    } else {
      messages.push({
        role: 'user',
        content: message
      });
    }

    // Send thinking status update
    ws.send(JSON.stringify({
      type: 'thinking_status',
      isThinking: false
    }));

    // Get OpenAI response (non-streaming for clean JSON parsing)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const fullResponse = completion.choices[0].message.content;
    
    // Parse the JSON response
    let responseData;
    try {
      responseData = JSON.parse(fullResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Extract clean data directly from JSON
    const cleanResponse = responseData.response;
    const emotionTag = responseData.emotion_tag.replace(/[\[\]]/g, ''); // Remove brackets if present

    console.log(`Extracted response: ${cleanResponse}`);
    console.log(`Extracted emotion: ${emotionTag}`);

    // Audio-only mode: Skip sending text response to client
    // Text is only generated for conversion to audio
    // This optimizes response speed by reducing data transmission

    // Send emotion detected (needed for voice selection and client-side emotion display)
    ws.send(JSON.stringify({
      type: 'emotion_detected',
      emotion: emotionTag
    }));

    // Get voice ID and generate audio
    const voiceId = getVoiceIdFromEmotionTag(emotionTag);
    
    try {
      const ttsResponse = await textToSpeech(cleanResponse, voiceId);
    
      for await (const chunk of ttsResponse.data) {
        // Convert the chunk to base64
        const audioBase64 = chunk.toString('base64');
      
        // Send the chunk to the client
        ws.send(JSON.stringify({
          type: 'audio_chunk',  // Changed type to indicate a chunk
          audio: audioBase64,
          format: 'mp3'        // Keep the format to help the client
        }));
      }
    
      // Signal the end of the audio stream
      ws.send(JSON.stringify({
        type: 'audio_complete'
      }));
    
    } catch (error) {
      console.error('Error generating audio:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error generating audio response'
      }));
    }

    // Generate unique ID for chat entry
    const chatId = Date.now().toString();

    // Store conversation entry
    const chatEntry = {
      id: chatId,
      question: message,
      response: cleanResponse,
      emotionTag: emotionTag,
      timestamp: new Date(),
      userId: userId
    };

    // Add to in-memory conversation history
    sessionData.conversationHistory.push(chatEntry);

    // Perform database operations asynchronously
    (async () => {
      try {
        // Start tracking user behavior
        const currentOpenTime = new Date();
        await updateUserBehaviorTracking(userId, currentOpenTime);
        
        // Save chat to Firestore
        const db = admin.firestore();
        
        // Save to chat history collection
        await db.collection('chatHistory').doc(chatId).set(chatEntry);
        
        // Update user's chat array
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
          await userRef.update({
            chatIds: admin.firestore.FieldValue.arrayUnion(chatId)
          });
        } else {
          await userRef.set({
            id: userId,
            chatIds: [chatId],
            emotionState: {
              currentEmotion: emotionTag,
              lastUpdated: new Date()
            }
          });
        }
        
        // Update emotion state
        await userRef.update({
          'emotionState.currentEmotion': emotionTag,
          'emotionState.lastUpdated': new Date()
        });
        
        // Get updated chat history and generate summary
        const updatedChatHistory = await getChatHistoryForUser(userId, 0);
        
        if (updatedChatHistory && updatedChatHistory.length > 0) {
          const newChatSummary = await generateChatSummary(updatedChatHistory);
          
          const chatSummaryRef = db.collection('chatSummary').doc(userId);
          const chatSummaryDoc = await chatSummaryRef.get();
          
          if (chatSummaryDoc.exists) {
            await chatSummaryRef.update({
              summary: newChatSummary,
              lastUpdated: new Date().toISOString()
            });
          } else {
            await chatSummaryRef.set({
              userId: userId,
              summary: newChatSummary,
              lastUpdated: new Date().toISOString()
            });
          }
        }
        
        console.log(`Successfully completed all database operations for user ${userId}`);
      } catch (error) {
        console.error('Error in post-response operations:', error);
      }
    })();

    // Send completion message
    ws.send(JSON.stringify({
      type: 'response_complete',
      messageId: chatId,
      emotion: emotionTag
    }));

  } catch (error) {
    console.error('Error generating response:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Error generating response'
    }));
    
    // Reset thinking status
    ws.send(JSON.stringify({
      type: 'thinking_status',
      isThinking: false
    }));
  }
}

// Handle audio messages (unchanged)
async function handleAudioMessage(ws, data, sessionData) {
  const { userId, audio, format } = data;
  
  // Send thinking status
  ws.send(JSON.stringify({
    type: 'thinking_status',
    isThinking: true
  }));

  try {
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    // Save audio to temporary file
    const tempFilePath = path.join(__dirname, 'temp-audio-' + Date.now() + '.' + format);
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Transcribe audio
    const transcribedText = await transcribeAudio(tempFilePath);
    
    // Delete temporary file
    fs.unlinkSync(tempFilePath);
    
    // Send transcription to client
    ws.send(JSON.stringify({
      type: 'transcription',
      text: transcribedText
    }));
    
    // Process the transcribed text as a user message
    await handleUserMessage(ws, { userId, message: transcribedText }, sessionData);
    
  } catch (error) {
    console.error('Error processing audio message:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Error processing audio message'
    }));
    
    // Reset thinking status
    ws.send(JSON.stringify({
      type: 'thinking_status',
      isThinking: false
    }));
  }
}

// Periodically sync in-memory sessions to Firestore (unchanged)
setInterval(async () => {
  console.log('Syncing in-memory sessions to Firestore...');
  for (const [userId, sessionData] of userSessions.entries()) {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    if (sessionData.lastActivity > oneHourAgo) {
      try {
        const updatedChatHistory = await getChatHistoryForUser(userId, 0);
        if (updatedChatHistory && updatedChatHistory.length > 0) {
          const newChatSummary = await generateChatSummary(updatedChatHistory);
          const db = admin.firestore();
          const chatSummaryRef = db.collection('chatSummary').doc(userId);
          
          await chatSummaryRef.set({
            userId: userId,
            summary: newChatSummary,
            lastUpdated: new Date().toISOString()
          }, { merge: true });
          
          console.log(`Synced session data for user ${userId}`);
        }
      } catch (error) {
        console.error(`Error syncing session data for user ${userId}:`, error);
      }
    }
  }
}, 5 * 60 * 1000);

// Export function (unchanged)
module.exports = function(wss) {
  if (!wss) {
    console.error('WebSocket server instance not provided!');
    return;
  }
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    let userId = 'test_user_id';
    let sessionData = {
      userId,
      conversationHistory: [],
      isTyping: false,
      lastActivity: Date.now()
    };

    ws.send(JSON.stringify({
      type: 'start_conversation',
      userId
    }));

    ws.on('message', async (message) => {
      try {
        let data;
        try {
          data = JSON.parse(message);
          console.log('Received message:', data.type);
        } catch (parseError) {
          const plainTextMessage = message.toString();
          console.log('Received plain text message:', plainTextMessage);
          data = {
            type: 'user_message',
            userId: 'test_user_id',
            message: plainTextMessage
          };
        }

        data.userId = 'test_user_id';
        userId = data.userId;

        if (!userSessions.has(userId)) {
          userSessions.set(userId, sessionData);
        } else {
          sessionData = userSessions.get(userId);
        }

        sessionData.lastActivity = Date.now();

        switch (data.type) {
          case 'message':
            // For messages sent with {type: 'message', text: '...'} format
            if (data.text !== undefined) {
              data.message = data.text;
            }
            await handleUserMessage(ws, data, sessionData);
            break;
          case 'user_message':
            await handleUserMessage(ws, data, sessionData);
            break;

          case 'audio_message':
            await handleAudioMessage(ws, data, sessionData);
            break;

          case 'typing_indicator':
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'typing_indicator',
                  userId: data.userId,
                  isTyping: data.isTyping
                }));
              }
            });
            break;

          default:
            console.log(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Error processing your message'
        }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  console.log('WebSocket handler initialized');
  return wss;
};
