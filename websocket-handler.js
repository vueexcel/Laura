const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { transcribeAudio } = require('./backend/helpers/transcriptionHelper');
const { textToSpeech, getVoiceIdFromEmotionTag } = require('./backend/helpers/audioHelper');
const { updateUserBehaviorTracking, getChatHistoryForUser, generateChatSummary } = require('./backend/helpers/firestoreHelper');
const { getFillerAudio, ensureFillerFilesExist } = require('./backend/helpers/fillerAudioHelper');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');

// Ensure filler audio files exist
ensureFillerFilesExist();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.apiKey // Use the apiKey from .env file directly
});

// In-memory session state management
const userSessions = new Map();

// Variable to track active response generation for interruption handling
let activeResponseGenerations = new Map();
// Generate unique ID for chat entry
const chatId = Date.now().toString();
// Handle user text messages
async function handleUserMessage(ws, data, sessionData) {
      const { userId, message, messageId, responseMode, mode } = data;
  
  // Store response mode in session data (default to 'both' if not specified)
  sessionData.responseMode = responseMode || sessionData.responseMode || 'both';
  
  // Store conversation mode in session data (default to 'neutral' if not specified)
  sessionData.mode = mode || sessionData.mode || 'neutral';
  
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

${sessionData.mode === 'neutral' ? 'CONVERSATION MODE: NEUTRAL - Respond in a balanced, conversational manner with a mix of personal connection and informative content. This is your default mode of interaction.' : ''}
${sessionData.mode === 'advice' ? 'CONVERSATION MODE: ADVICE - Focus on providing helpful guidance, suggestions, and recommendations. Be more direct and solution-oriented while maintaining your empathetic nature. Prioritize actionable advice that can help the user with their situation.' : ''}
${sessionData.mode === 'focus' ? 'CONVERSATION MODE: FOCUS - Be concise and to-the-point. Minimize small talk and focus primarily on delivering accurate, relevant information efficiently. While still maintaining your personality, prioritize clarity and brevity in your responses.' : ''}

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
    
    // Store this active response generation
    const responseId = Date.now().toString();
    activeResponseGenerations.set(userId, responseId);

    // Get OpenAI response (non-streaming for clean JSON parsing)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const fullResponse = completion.choices[0].message.content;
    
    // Log the response time for monitoring latency
    console.log(`OpenAI response received in ${Date.now() - responseId}ms for user ${userId}`);
    
    // Parse the JSON response
    let responseData;
    try {
      // Check if the response is already valid JSON
      responseData = JSON.parse(fullResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      console.log('Raw response from OpenAI:', fullResponse);
      
      // Attempt to extract a valid JSON object if the response contains one
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          responseData = JSON.parse(jsonMatch[0]);
          console.log('Successfully extracted JSON from response');
        } catch (extractError) {
          console.error('Failed to extract JSON from response:', extractError);
          // Create a fallback response
          responseData = {
            response: "I'm having trouble processing your request right now. Could you try again?",
            emotion_tag: "neutral"
          };
        }
      } else {
        // If no JSON-like structure is found, create a fallback response
        responseData = {
          response: fullResponse.replace(/\[.*?\]/g, '').trim(), // Remove any emotion tags
          emotion_tag: "neutral"
        };
        console.log('Created fallback response from text');
      }
    }

    // Extract clean data directly from JSON
    const cleanResponse = responseData.response;
    const emotionTag = responseData.emotion_tag.replace(/[\[\]]/g, ''); // Remove brackets if present

    console.log(`Extracted response: ${cleanResponse}`);
    console.log(`Extracted emotion: ${emotionTag}`);

    // Send emotion detected (needed for voice selection and client-side emotion display)
    ws.send(JSON.stringify({
      type: 'emotion_detected',
      emotion: emotionTag
    }));
    
    // Send filler audio immediately after emotion detection if audio response is enabled
    if (sessionData.responseMode === 'audio' || sessionData.responseMode === 'both') {
      try {
        // Get appropriate filler audio based on emotion and response length
        const fillerAudio = await getFillerAudio(emotionTag, cleanResponse.length);
        
        if (fillerAudio) {
          // Send filler audio to client
          ws.send(JSON.stringify({
            type: 'filler_audio',
            audio: fillerAudio.audio,
            format: fillerAudio.format,
            messageId: messageId,
            fillerName: fillerAudio.fillerName
          }));
          
          console.log(`Sent filler audio (${fillerAudio.fillerName}) for emotion: ${emotionTag}`);
        }
      } catch (error) {
        console.error('Error sending filler audio:', error);
        // Continue with normal response even if filler fails
      }
    }
    
    // Start audio generation in parallel (if needed) before text streaming
    let audioPromise = null;
    let startTime = null; // Declare startTime at a higher scope
    
    if (sessionData.responseMode === 'audio' || sessionData.responseMode === 'both') {
      const voiceId = getVoiceIdFromEmotionTag(emotionTag);
      // Submit the entire assistant response to ElevenLabs in one API call
      // This reduces latency by avoiding multiple API calls
      console.log(`Submitting entire response to ElevenLabs for user ${userId}`);
      startTime = Date.now(); // Assign value to the variable declared above
      
      // Start the TTS request but don't await it yet - we'll process it in parallel with text streaming
      audioPromise = textToSpeech(cleanResponse, voiceId).catch(error => {
        console.error('Error initiating audio generation:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Error generating audio response'
        }));
        return null; // Return null to indicate error
      });
      console.log(`Started audio generation in parallel for user ${userId}`);
    }

    // Immediately start text streaming (don't wait for audio)
    if (sessionData.responseMode === 'text' || sessionData.responseMode === 'both') {
      const chunkSize = 10; // Number of characters per chunk
      const streamTextPromise = (async () => {
        for (let i = 0; i < cleanResponse.length; i += chunkSize) {
          // Check if this response has been interrupted
          if (activeResponseGenerations.get(userId) !== responseId) {
            console.log(`Response generation ${responseId} was interrupted`);
            break;
          }
          
          const textChunk = cleanResponse.substring(i, i + chunkSize);
          ws.send(JSON.stringify({
            type: 'text_chunk',
            text: textChunk,
            messageId: messageId // Pass through the message ID for timeout handling
          }));
          
          // Small delay between chunks to simulate typing
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.log(`Completed text streaming for user ${userId}`);
      })();
      
      // Don't await the text streaming - let it run in parallel with audio processing
    } else {
      console.log(`Skipping text response for user ${userId} (responseMode: ${sessionData.responseMode})`);
    }

    // Process audio stream in parallel with text streaming
    if (audioPromise) {
      try {
        const ttsResponse = await audioPromise;
        if (ttsResponse) {
          const audioStartTime = Date.now();
          console.log(`Audio stream from ElevenLabs received in ${audioStartTime - startTime}ms for user ${userId}`);
          
          // Stream the audio directly from ElevenLabs to the client as binary data
          // This avoids base64 conversion overhead and is more efficient
          let chunkCount = 0;
          let totalBytes = 0;
          
          ttsResponse.data.on('data', (chunk) => {
            chunkCount++;
            totalBytes += chunk.length;
            
            // First send a small JSON message to notify the client about the incoming binary chunk
            ws.send(JSON.stringify({
              type: 'audio_chunk_header',
              chunkSize: chunk.length,
              format: 'mp3',
              messageId: messageId,
              emotion: emotionTag,
              chunkNumber: chunkCount
            }));
            
            // Then send the actual binary chunk directly without base64 conversion
            // This enables immediate playback as soon as chunks arrive
            ws.send(chunk);
          });
          
          ttsResponse.data.on('end', () => {
            // Signal that audio streaming is complete
            ws.send(JSON.stringify({
              type: 'audio_complete',
              messageId: messageId
            }));
            console.log(`Completed audio streaming for user ${userId}`);
            console.log(`Streamed ${chunkCount} audio chunks (${totalBytes} bytes) in ${Date.now() - audioStartTime}ms`);
            
            // Now that audio streaming is complete, send the response_complete message
            ws.send(JSON.stringify({
              type: 'response_complete',
              messageId: messageId || chatId, // Use the original messageId if available
              emotion: emotionTag,
              responseMode: sessionData.responseMode, // Include the response mode used
              mode: sessionData.mode // Include the conversation mode used
            }));
          });
          
          ttsResponse.data.on('error', (err) => {
            console.error('Error in audio stream:', err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Error in audio stream'
            }));
          });
        }
      } catch (error) {
        console.error('Error processing audio stream:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Error generating audio response'
        }));
      }
    } else {
      console.log(`Skipping audio response for user ${userId} (responseMode: ${sessionData.responseMode})`);
      
      // If no audio response, send response_complete immediately
      ws.send(JSON.stringify({
        type: 'response_complete',
        messageId: messageId || chatId, // Use the original messageId if available
        emotion: emotionTag,
        responseMode: sessionData.responseMode,
        mode: sessionData.mode
      }));
    }



    // Store conversation entry
    const chatEntry = {
      id: chatId,
      question: message,
      response: cleanResponse,
      emotionTag: emotionTag,
      timestamp: new Date(),
      userId: userId
      // Removed duplicate user_id field
    };
    
    // If this is an audio message, add a flag and ensure we're not storing raw audio data
    if (data.isAudioMessage) {
      chatEntry.audioSource = true; // Add a flag to indicate this came from audio
      
      // Make sure we're not storing raw audio data in the database
      // We only want to store the transcribed text in the question field
      if (data.originalAudio) {
        // Don't store the original audio data in the database
        console.log('Audio message detected - storing transcribed text only');
        
        // Check if the message is actually transcribed text and not raw audio data
        // If message contains base64 patterns or is too long, it might be raw audio data
        if (message.length > 1000 || /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(message)) {
          console.warn('Detected possible raw audio data in message - not saving to chat history');
          return; // Exit early without saving to chat history
        }
      }
    }
    
    // Ensure no JSON data is saved in the chat history
    if (typeof message === 'string' && (message.trim().startsWith('{') && message.trim().endsWith('}')) || 
        (message.trim().startsWith('[') && message.trim().endsWith(']'))) {
      console.warn('Detected possible JSON data in message - not saving raw JSON to chat history');
      // Try to extract text content if it's a JSON object with a text/message field
      try {
        const jsonObj = JSON.parse(message.trim());
        if (jsonObj.text || jsonObj.message || jsonObj.content) {
          chatEntry.question = jsonObj.text || jsonObj.message || jsonObj.content;
          console.log('Extracted text content from JSON object for chat history');
        } else {
          console.warn('JSON object does not contain recognizable text field - using placeholder');
          chatEntry.question = "[Message contained data that couldn't be displayed]";
        }
      } catch (e) {
        console.warn('Failed to parse JSON data - using placeholder');
        chatEntry.question = "[Message contained data that couldn't be displayed]";
      }
    }

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

    // Only send completion message immediately if there's no audio response
    // For audio responses, the completion message will be sent after audio streaming is complete
    if (!audioPromise) {
      ws.send(JSON.stringify({
        type: 'response_complete',
        messageId: messageId || chatId, // Use the original messageId if available
        emotion: emotionTag,
        responseMode: sessionData.responseMode, // Include the response mode used
        mode: sessionData.mode // Include the conversation mode used
      }));
    }
    
    // Clear the active response generation
    if (activeResponseGenerations.get(userId) === responseId) {
      activeResponseGenerations.delete(userId);
    }

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

// Handle audio messages
async function handleAudioMessage(ws, data, sessionData) {
  const { userId, audio, format, messageId } = data;
  
  // Send thinking status
  ws.send(JSON.stringify({
    type: 'thinking_status',
    isThinking: true
  }));

  try {
    // Validate audio data
    if (!audio || typeof audio !== 'string') {
      console.warn('Invalid audio data: Audio data is missing or not a string');
      const errorMessage = "I didn't receive valid audio data. Please try recording again.";
      ws.send(JSON.stringify({
        type: 'transcription',
        text: errorMessage
      }));
      //STOP
      ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
      // Don't process the error message further - just stop here
      return; // Stop further processing
    }

    // Check if the audio string looks like JSON (might be a client error sending raw JSON)
    if (audio.trim().startsWith('{') && audio.trim().endsWith('}')) {
      console.warn('Received JSON-like string as audio data');
      const errorMessage = "I received what appears to be JSON data instead of audio. Please try recording again or check your audio settings.";
      
      // Send transcription error to client
      ws.send(JSON.stringify({
        type: 'transcription',
        text: errorMessage
      }));
      //STOP
      ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
      // Don't process the error message further - just stop here
      return; // Stop processing further
    }
    
    // Try to convert base64 audio to buffer
    let audioBuffer;
    try {
      // Check if the audio string is complete (not truncated)
      if (audio.length % 4 !== 0) {
        console.warn('Audio data appears to be truncated or incomplete');
        throw new Error('Audio data is incomplete or truncated');
      }
      
      // Try to clean the base64 string if it contains invalid characters
      const cleanedAudio = audio.replace(/[^A-Za-z0-9+/=]/g, '');
      
      audioBuffer = Buffer.from(cleanedAudio, 'base64');
      
      // Check if the buffer is too small or empty (likely invalid audio)
      if (audioBuffer.length < 100) { // Arbitrary small size threshold
        throw new Error('Audio data too small to be valid');
      }
      
      console.log(`Successfully converted audio to buffer of size: ${audioBuffer.length} bytes`);
    } catch (bufferError) {
      console.error('Error converting audio to buffer:', bufferError);
      const errorMessage = "The audio data appears to be corrupted or incomplete. Please try recording again.";
      ws.send(JSON.stringify({
        type: 'transcription',
        text: errorMessage
      }));
      //STOP
      ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
      // Don't process the error message further - just stop here
      return; // Stop processing further
    }
    
    // Transcribe audio directly from buffer without saving to a temporary file
    const transcribedText = await transcribeAudio(audioBuffer, format);
    
    // Check if transcription failed (and transcribeAudio returned an error message)
    if (transcribedText.includes("I couldn't detect any clear speech") || transcribedText.includes("I had trouble processing your audio") || transcribedText.includes("user is silence")) {
      console.warn(`Transcription failed for user ${userId}: ${transcribedText}`);
      ws.send(JSON.stringify({ type: 'transcription', text: transcribedText })); // Send error to client
      //STOP
      ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
      // Don't process the error message further - just stop here
      return; // Stop processing
    }
    
    // Send transcription to client
    ws.send(JSON.stringify({
      type: 'transcription',
      text: transcribedText
    }));
    
    // Process the transcribed text as a user message (preserving responseMode and mode)
    //NEW IF STOP
    if (transcribedText) {
        // Check if transcription was successful (not an error message)
        const isTranscriptionError = transcribedText.includes("I couldn't detect any clear speech") || 
                                   transcribedText.includes("I had trouble processing your audio") ||
                                   transcribedText.includes("user is silence");
        
        await handleUserMessage(ws, { 
            userId, 
            message: transcribedText, 
            messageId,
            responseMode: data.responseMode || sessionData.responseMode,
            mode: data.mode || sessionData.mode,
            isAudioMessage: true,
            // Always set originalAudio to null to prevent storing raw audio data
            originalAudio: null
        }, sessionData);
    }
  } catch (error) {
    console.error('Error processing audio message:', error);
    
    // Create a user-friendly error message
    const errorMessage = error.message.includes('Invalid base64') || error.message.includes('too small') ?
      "I couldn't process your audio recording. It may be corrupted or empty. Please try recording again or type your message instead." :
      "I had trouble processing your audio. Could you please try speaking more clearly or typing your message instead.";
    
    // Send error to client
    ws.send(JSON.stringify({
      type: 'error',
      message: errorMessage
    }));
    //STOP
      ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));

    // Also send as transcription so it appears in the chat
    ws.send(JSON.stringify({
      type: 'transcription',
      text: errorMessage
    }));

       // Don't process the error message further - just stop here
       // No need to call handleUserMessage for error cases
    }
}

// Periodic syncing of in-memory sessions to Firestore has been disabled as requested
// This code was previously responsible for syncing sessions and updating chat summaries
// It has been commented out to prevent the generation of unnecessary chat summaries
/*
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
*/

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
      lastActivity: Date.now(),
      responseMode: 'both', // Default to both text and audio responses
      mode: 'neutral' // Default conversation mode
    };

    ws.send(JSON.stringify({
      type: 'start_conversation',
      userId
    }));

    // Add this at the top of the file with other variables
    
    // Modify the ws.on('message') handler
    ws.on('message', async (message) => {
      try {
        
        // Handle JSON messages as before
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
        
        // Extract responseMode if present and update session data
        if (data.responseMode) {
          // Validate responseMode value
          if (['text', 'audio', 'both'].includes(data.responseMode)) {
            sessionData.responseMode = data.responseMode;
            console.log(`Response mode set to: ${data.responseMode} for user ${userId}`);
          } else {
            console.warn(`Invalid responseMode value: ${data.responseMode}, using default`);
          }
        }
        
        // Extract conversation mode if present and update session data
        if (data.mode) {
          // Validate mode value
          if (['neutral', 'advice', 'focus'].includes(data.mode)) {
            sessionData.mode = data.mode;
            console.log(`Conversation mode set to: ${data.mode} for user ${userId}`);
          } else {
            console.warn(`Invalid mode value: ${data.mode}, using default 'neutral'`);
          }
        }
        
        switch (data.type) {
          case 'audio_message_metadata':
            // Store metadata for the upcoming binary audio data
            pendingAudioMessages.set(userId, data);
            break;
            
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
          case 'interrupt':
            // Handle interruption by clearing the active response
            if (activeResponseGenerations.has(userId)) {
              console.log(`Interrupting response for user ${userId}`);
              activeResponseGenerations.delete(userId);
              ws.send(JSON.stringify({
                type: 'response_interrupted'
              }));
            }
            break;

          case 'audio_message':
            // Legacy support for base64 encoded audio
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