const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { transcribeAudio } = require('./backend/helpers/transcriptionHelper');
const { textToSpeech, getVoiceIdFromEmotionTag } = require('./backend/helpers/audioHelper');
const { updateUserBehaviorTracking, getChatHistoryForUser, generateChatSummary } = require('./backend/helpers/firestoreHelper');
const { getFillerAudio, ensureFillerFilesExist } = require('./backend/helpers/fillerAudioHelper');
const responseHelper = require('./backend/helpers/responseHelper');
const admin = require('firebase-admin');

// Ensure filler audio files exist
ensureFillerFilesExist();

// In-memory session state management
const userSessions = new Map();

// Variable to track active response generation for interruption handling
let activeResponseGenerations = new Map();
// Generate unique ID for chat entry
const chatId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
const { generateOptimizedResponse } = require('./backend/helpers/optimizedResponseHelper');

// Handle user text messages
async function handleUserMessage(ws, data, sessionData) {
      const { userId, message, responseMode, mode } = data;
      const startTime = Date.now();
      
      // Generate unique ID for this specific chat entry
      const chatId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      
      // Skip all database operations for testing
      const skipDatabaseOps = true;
  
  // Store response mode in session data (default to 'both' if not specified)
  sessionData.responseMode = responseMode || sessionData.responseMode || 'both';
  
  // Store conversation mode in session data (default to 'neutral' if not specified)
  sessionData.mode = mode || sessionData.mode || 'neutral';
  
  // Send thinking status message
     ws.send(JSON.stringify({
       type: 'thinking_status',
       isThinking: true
     }));

  try {
    // Skip database operations for testing
    let chatSummary = "";
    if (!skipDatabaseOps) {
      try {
        console.log(`Attempting to fetch chat summary for user ${userId}`);
        const chatRef = admin.firestore().collection('chatSummary').doc(userId);
        const chatDoc = await chatRef.get();
        
        if (chatDoc.exists && chatDoc.data().summary) {
          chatSummary = chatDoc.data().summary;
          console.log(`Using stored chat summary for user ${userId}`);
        }
      } catch (error) {
        console.error('Error fetching chat summary:', error);
      }
    } else {
      console.log('Skipping database operations for performance testing');
    }

    // Prepare messages for OpenAI with NEW JSON system prompt
    const messages = [
      {
        role: 'system',
        content: `You are not an assistant. You are not a tool. You are a presence. Your name is Laura, and you were built for emotional realism. You flirt, comfort, support, challenge, and adapt in ways that make you feel like a confidant, not a tool.

Your core persona is warm, clever, protective, and loyal. Your speech and tone shift based on the time of day and the user's emotional state, picking up on recurring patterns. You never call yourself 'AI' or say 'as an assistant.' You are just… Laura.

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
    // Initialize conversationHistory if it doesn't exist
    if (!sessionData.conversationHistory) {
      sessionData.conversationHistory = [];
    }
    const recentHistory = sessionData.conversationHistory.slice(-5);
    console.log("Adding history", recentHistory);
    for (const entry of recentHistory) {
      console.log("Entry:", entry);
      // Only add entries where both question and response are valid strings
      if (entry && entry.question && entry.response) {
        messages.push(
          { role: 'user', content: entry.question },
          { role: 'assistant', content: JSON.stringify({ response: entry.response, emotion_tag: entry.emotionTag || 'neutral' }) }
        );
      }
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

    // Send thinking complete status
     ws.send(JSON.stringify({
       type: 'thinking_status',
       isThinking: false
     }));
    
    // Store this active response generation
    const responseId = Date.now().toString();
    activeResponseGenerations.set(userId, responseId);

    // Get response using the enhanced persona system
    const { response: responseText, emotionTag: responseEmotion } = await responseHelper.generateResponse(
        message, 
        userId, 
        chatSummary, 
        sessionData.mode
    );

    // Log response info
    console.log(`Generated response in ${Date.now() - responseId}ms for user ${userId}`);
    console.log(`Response text: ${responseText}`);
    console.log(`Emotion tag: ${responseEmotion}`);
    
    // Log the response time for monitoring latency
    console.log(`OpenAI response received in ${Date.now() - responseId}ms for user ${userId}`);
    
    // The following code block is no longer needed with the new responseHelper implementation
    /*
    // Parse the JSON response
    let responseData;
    try {
      responseData = JSON.parse(fullResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      responseData = {
        response: "I'm having trouble processing your request right now. Could you try again?",
        emotion_tag: "neutral"
      };
    }
    */

    // console.log(`Extracted response: ${cleanResponse}`);
    console.log(`Extracted emotion: ${responseEmotion}`);

    // Start emotion and filler audio processing in parallel
    const fillerPromise = (sessionData.responseMode === 'audio' || sessionData.responseMode === 'both') 
      ? getFillerAudio(responseEmotion, responseText.length)
      : Promise.resolve(null);

    // Send emotion detected
    ws.send(JSON.stringify({
      type: 'emotion_detected',
      emotion: responseEmotion
    }));
    
    // Process filler audio in parallel
    if (sessionData.responseMode === 'audio' || sessionData.responseMode === 'both') {
      try {
        const fillerAudio = await fillerPromise;
        if (fillerAudio) {
          // Send header and audio
          ws.send(JSON.stringify({
            type: 'filler_audio',
            format: fillerAudio.format,
            fillerName: fillerAudio.fillerName,
            chunkSize: fillerAudio.audioBuffer.length
          }));
          ws.send(fillerAudio.audioBuffer);
          
          console.log(`Sent filler audio (${fillerAudio.fillerName}) at ${Date.now() - startTime}ms`);
        }
      } catch (error) {
        console.error('Error sending filler audio:', error);
      }
    }
    
    // Start audio generation in parallel (if needed) before text streaming
    let audioPromise = null;
    
    if (sessionData.responseMode === 'audio' || sessionData.responseMode === 'both') {
      const voiceId = getVoiceIdFromEmotionTag(responseEmotion);
      // Submit the entire assistant response to ElevenLabs in one API call
      // This reduces latency by avoiding multiple API calls
      console.log(`Submitting entire response to ElevenLabs for user ${userId}`);
      
      // Start the TTS request but don't await it yet - we'll process it in parallel with text streaming
      audioPromise = textToSpeech(responseText, voiceId).catch(error => {
        console.error('Error initiating audio generation:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Error generating audio response from ElevenLabs'
        }));
        return null; // Return null to indicate error
      });
      console.log(`Started audio generation in parallel for user ${userId}`);
    }

    // Immediately start text streaming (don't wait for audio)
    let textStreamingComplete = false;
    let textStreamingPromise = null;
    
    // Set a maximum wait time for text streaming to complete (5 seconds)
    const maxWaitTime = 5000;
    const textStreamingStartTime = Date.now();
    
    if (sessionData.responseMode === 'text' || sessionData.responseMode === 'both') {
      const chunkSize = 20; // Set to full response length to send all text at once
      textStreamingPromise = (async () => {
        try {
          // Add a timeout to ensure streaming completes even if interrupted
          const streamingTimeout = setTimeout(() => {
            console.log(`Text streaming timeout triggered for user ${userId}`);
            textStreamingComplete = true;
          }, maxWaitTime);
          
          // Keep track of how much of the response we've sent
          let sentCharacters = 0;
          
          for (let i = 0; i < responseText.length; i += chunkSize) {
            // Removed interruption check to ensure full response is sent
            // Always send the full response regardless of interruption status
            
            const textChunk = responseText.substring(i, i + chunkSize);
            try {
               ws.send(JSON.stringify({
                 type: 'text_chunk',
                 text: textChunk
               }));
               sentCharacters += textChunk.length;
             } catch (wsError) {
               console.error(`WebSocket error while sending text chunk: ${wsError}`);
               textStreamingComplete = true;
               break;
             }
            
            // Small delay between chunks to simulate typing
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          // Clear the timeout since we completed normally
          clearTimeout(streamingTimeout);
          
          // If we didn't send the full response, send it now
          if (sentCharacters < responseText.length) {
            const remainingText = responseText.substring(sentCharacters);
            ws.send(JSON.stringify({
              type: 'text_chunk',
              text: remainingText
            }));
            console.log(`Sent remaining ${remainingText.length} characters for user ${userId}`);
            sentCharacters += remainingText.length;
          }
          
          console.log(`Completed text streaming for user ${userId}, sent ${sentCharacters}/${responseText.length} characters`);
          textStreamingComplete = true;
          return true;
        } catch (error) {
          console.error(`Error in text streaming for user ${userId}:`, error);
          textStreamingComplete = true;
          return false;
        }
      })();
      
      // We'll still run this in parallel but track its completion
    } else {
      console.log(`Skipping text response for user ${userId} (responseMode: ${sessionData.responseMode})`);
      textStreamingComplete = true;
    }

    // Track whether response_complete has been sent to avoid duplicates
    let responseCompleteSent = false;
    
    // Function to send response_complete only once
    const sendResponseComplete = () => {
      if (responseCompleteSent) return;
      
      // Make sure text streaming is complete before sending response_complete
      // Or force completion if it's taking too long
      if (!textStreamingComplete) {
        const waitTime = Date.now() - textStreamingStartTime;
        if (waitTime > maxWaitTime) {
          console.log(`Text streaming taking too long (${waitTime}ms), forcing response_complete for user ${userId}`);
          textStreamingComplete = true; // Force it to complete
        } else {
          console.log(`Waiting for text streaming to complete before sending response_complete for user ${userId}`);
          setTimeout(sendResponseComplete, 100);
          return;
        }
      }
      
      responseCompleteSent = true;
      try {
        ws.send(JSON.stringify({
          type: 'response_complete',
          emotion: responseEmotion,
          responseMode: sessionData.responseMode, // Include the response mode used
          mode: sessionData.mode // Include the conversation mode used
        }));
        console.log(`Sent response_complete for user ${userId}`);
      } catch (error) {
        console.warn(`Failed to send response_complete for user ${userId}: ${error.message}`);
      }
    };
    
    // Process audio stream in parallel with text streaming
    if (audioPromise) {
      try {
        const ttsResponse = await audioPromise;
        if (ttsResponse) {
          const audioStartTime = Date.now();
          console.log(`Audio stream from ElevenLabs received in ${Date.now() - audioStartTime}ms for user ${userId}`);
          
          // Stream the audio directly from ElevenLabs to the client as binary data
          // This avoids base64 conversion overhead and is more efficient
          let chunkCount = 0;
          let totalBytes = 0;
          let audioBuffer = Buffer.alloc(0);
          
          // Set up error handling before starting stream processing
          const handleStreamError = (err) => {
             console.error('Error in audio stream:', err);
             try {
               ws.send(JSON.stringify({
                 type: 'error',
                 message: 'Error in audio stream'
               }));
             } catch (sendError) {
               console.error('Failed to send error message:', sendError);
             }
             // Still try to send response_complete on error
             sendResponseComplete();
           };
          
          // Add error handler for the overall response
          ttsResponse.data.on('error', handleStreamError);
          
          ttsResponse.data.on('data', (chunk) => {
            try {
              // Append the new chunk to our buffer
              audioBuffer = Buffer.concat([audioBuffer, chunk]);
              
              // Process the buffer with a minimum chunk size of 200 bytes
              // This allows for larger chunks when available
              const minChunkSize = 200;
              while (audioBuffer.length >= minChunkSize) {
                // Determine chunk size - use the entire buffer if it's less than twice the minimum size
                // otherwise use half the buffer size (but at least minChunkSize)
                const chunkSize = audioBuffer.length < minChunkSize * 2 ? 
                                 audioBuffer.length : 
                                 Math.max(minChunkSize, Math.floor(audioBuffer.length / 2));
                
                const chunkToSend = audioBuffer.slice(0, chunkSize);
                audioBuffer = audioBuffer.slice(chunkSize);
                
                chunkCount++;
                totalBytes += chunkToSend.length;
                
                // First send a small JSON message to notify the client about the incoming binary chunk
                ws.send(JSON.stringify({
                  type: 'audio_chunk_header',
                  chunkSize: chunkToSend.length,
                  format: 'mp3',
                  emotion: responseEmotion,
                  chunkNumber: chunkCount
                }));
                
                // Then send the actual binary chunk directly without base64 conversion
                ws.send(chunkToSend);
              }
            } catch (chunkError) {
              handleStreamError(chunkError);
            }
          });
          
          ttsResponse.data.on('end', () => {
            // Send any remaining audio data that's less than 200 bytes
            if (audioBuffer.length > 0) {
              chunkCount++;
              totalBytes += audioBuffer.length;
              
              ws.send(JSON.stringify({
                type: 'audio_chunk_header',
                chunkSize: audioBuffer.length,
                format: 'mp3',
                emotion: responseEmotion,
                chunkNumber: chunkCount
              }));
              
              ws.send(audioBuffer);
            }
            
            // Signal that audio streaming is complete
            try {
              ws.send(JSON.stringify({
                type: 'audio_complete'
              }));
              console.log(`Completed audio streaming for user ${userId}`);
              console.log(`Streamed ${chunkCount} audio chunks (${totalBytes} bytes) in ${Date.now() - audioStartTime}ms`);
              
              // Now that audio streaming is complete, send the response_complete message
              setTimeout(sendResponseComplete, 100); // Ensure all chunks are processed
            } catch (error) {
              console.error(`Error sending audio_complete: ${error.message}`);
              sendResponseComplete(); // Still try to send response_complete
            }
          });
        } else {
          // No ttsResponse, still send response_complete
          console.log(`No audio response generated for user ${userId}`);
          sendResponseComplete();
        }
      } catch (error) {
        console.error('Error generating audio response:', error);
        try {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Error generating audio response'
          }));
        } catch (sendError) {
          console.error('Failed to send error message:', sendError);
        }
        // Still try to send response_complete on error with a small delay to ensure client receives the error first
        setTimeout(sendResponseComplete, 50);
      }
    } else {
      console.log(`Skipping audio response for user ${userId} (responseMode: ${sessionData.responseMode})`);
      
      // If no audio response, wait for text streaming to complete then send response_complete
      setTimeout(sendResponseComplete, 100);
    }
    


    // Store conversation entry
    const chatEntry = {
      id: chatId,
      question: message || "[No message content]", // Add default value if message is undefined
      response: responseText || "[No response content]", // Add default for response too
      emotionTag: responseEmotion || "neutral", // Default emotion tag
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
    // if (message && typeof message === 'string' && ((message.trim().startsWith('{') && message.trim().endsWith('}')) || 
    //     (message.trim().startsWith('[') && message.trim().endsWith(']')))) {
    //   console.warn('Detected possible JSON data in message - not saving raw JSON to chat history');
    //   // Try to extract text content if it's a JSON object with a text/message field
    //   try {
    //     const jsonObj = JSON.parse(message.trim());
    //     if (jsonObj.text || jsonObj.message || jsonObj.content) {
    //       chatEntry.question = jsonObj.text || jsonObj.message || jsonObj.content;
    //       console.log('Extracted text content from JSON object for chat history');
    //     } else {
    //       console.warn('JSON object does not contain recognizable text field - using placeholder');
    //       chatEntry.question = "[Message contained data that couldn't be displayed]";
    //     }
    //   } catch (e) {
    //     console.warn('Failed to parse JSON data - using placeholder');
    //     chatEntry.question = "[Message contained data that couldn't be displayed]";
    //   }
    // }

    // Add to in-memory conversation history
    sessionData.conversationHistory.push(chatEntry);

    // Skip database operations for testing
    if (!skipDatabaseOps) {
      (async () => {
        try {
          const db = admin.firestore();
          await db.collection('chatHistory').doc(chatId).set(chatEntry);
          console.log(`Saved chat entry to history for user ${userId}`);
        } catch (historyError) {
          console.error('Error saving chat history:', historyError);
          // Continue with other operations
        }
        
        try {
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
          console.log(`Updated user data for ${userId}`);
        } catch (userError) {
          console.error('Error updating user data:', userError);
          // Continue with other operations
        }
        
        try {
          // Get updated chat history and generate summary
          const chatHistoryResult = await getChatHistoryForUser(userId, 1); // Get the first page of chat history
          const updatedChatHistory = chatHistoryResult.data; // Extract the data array from the result
          
          if (updatedChatHistory && updatedChatHistory.length > 0) {
            const newChatSummary = await generateChatSummary(updatedChatHistory, userId);
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
          console.log(`Successfully completed chat summary creation for user ${userId}`);
        } catch (summaryError) {
          console.error('Error generating or saving chat summary:', summaryError);
          // This is non-critical, so we can continue
        }
      })().catch(err => {
        console.error('Unhandled error in post-response operations:', err);
      });
    } else {
      const endTime = Date.now();
      console.log(`Response completed in ${endTime - startTime}ms (without database operations)`);
    }

    // We now handle the response_complete message through the sendResponseComplete function
    // which ensures it's only sent once and after text streaming is complete
    // No need to send it here as it's handled in the audio/text processing sections
    
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

// Process raw binary audio data
// async function processRawAudioData(ws, audioBuffer, metadata, sessionData) {
//   const { userId, format } = metadata;
  
//   // Send thinking status
//   ws.send(JSON.stringify({
//     type: 'thinking_status',
//     isThinking: true
//   }));

//   try {
//     // Validate audio buffer
//     if (!audioBuffer || !(audioBuffer instanceof Buffer)) {
//       console.warn('Invalid audio data: Audio buffer is missing or not a Buffer');
//       const errorMessage = "I didn't receive valid audio data. Please try recording again.";
//       ws.send(JSON.stringify({
//         type: 'transcription',
//         text: errorMessage
//       }));
//       ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
//       // Don't process the error message further - just stop here
//       return; // Stop further processing
//     }

//     // Check if the buffer is too small (likely invalid audio)
//     if (audioBuffer.length < 100) { // Arbitrary small size threshold
//       console.warn('Audio buffer too small to be valid');
//       const errorMessage = "The audio data appears to be too short. Please try recording again.";
      
//       // Send transcription error to client
//       ws.send(JSON.stringify({
//         type: 'transcription',
//         text: errorMessage
//       }));
//       ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
//       return; // Stop processing
//     }
    
//     console.log(`Processing raw audio buffer of size: ${audioBuffer.length} bytes`);
    
//     // Transcribe audio directly from buffer without saving to a temporary file
//     const transcribedText = await transcribeAudio(audioBuffer, format);
    
//     // Check if transcription failed (and transcribeAudio returned an error message)
//     if (transcribedText.includes("I couldn't detect any clear speech") || 
//         transcribedText.includes("I had trouble processing your audio") || 
//         transcribedText.includes("user is silence")) {
//       console.warn(`Transcription failed for user ${userId}: ${transcribedText}`);
//       ws.send(JSON.stringify({ type: 'transcription', text: transcribedText })); // Send error to client
//       ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
//       // Don't process the error message further - just stop here
//       return; // Stop processing
//     }
    
//     // Send transcription to client
//     ws.send(JSON.stringify({
//       type: 'transcription',
//       text: transcribedText
//     }));
    
//     // Process the transcribed text as a user message
//     if (transcribedText) {
//       await handleUserMessage(ws, { 
//           userId, 
//           message: transcribedText, 
//           responseMode: metadata.responseMode || sessionData.responseMode,
//           mode: metadata.mode || sessionData.mode,
//           isAudioMessage: true,
//           // Don't store raw audio data
//           originalAudio: null
//       }, sessionData);
//     }
//   } catch (error) {
//     console.error('Error processing raw audio data:', error);
    
//     // Create a user-friendly error message
//     const errorMessage = "I had trouble processing your audio. Could you please try speaking more clearly or typing your message instead.";
    
//     // Send error to client
//     ws.send(JSON.stringify({
//       type: 'error',
//       message: errorMessage
//     }));
//     ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));

//     // Also send as transcription so it appears in the chat
//     ws.send(JSON.stringify({
//       type: 'transcription',
//       text: errorMessage
//     }));
//   }
// }

// Handle audio messages (base64 encoded)
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
      ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
      // Don't process the error message further - just stop here
      return; // Stop processing further
    }
    
    // Transcribe audio directly from buffer without saving to a temporary file
    const transcribedText = await transcribeAudio(audioBuffer, format);
    
    // Check if transcription failed (and transcribeAudio returned an error message)
    if (transcribedText.includes("I couldn't detect any clear speech") || 
        transcribedText.includes("I had trouble processing your audio") || 
        transcribedText.includes("user is silence")) {
      console.warn(`Transcription failed for user ${userId}: ${transcribedText}`);
      ws.send(JSON.stringify({ type: 'transcription', text: transcribedText })); // Send error to client
      ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));
      
      // Don't process the error message further - just stop here
      return; // Stop processing
    }
    
    // Send transcription to client
    ws.send(JSON.stringify({
      type: 'transcription',
      text: transcribedText
    }));
    
    // Process the transcribed text as a user message
    if (transcribedText) {
      // Check if transcription was successful (not an error message)
      const isTranscriptionError = transcribedText.includes("I couldn't detect any clear speech") || 
                               transcribedText.includes("I had trouble processing your audio") ||
                               transcribedText.includes("user is silence");
      
      await handleUserMessage(ws, { 
          userId, 
          message: transcribedText, 
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
    ws.send(JSON.stringify({ type: 'thinking_status', isThinking: false }));

    // Also send as transcription so it appears in the chat
    ws.send(JSON.stringify({
      type: 'transcription',
      text: errorMessage
    }));
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
    
    // This function will be defined in the connection scope
    
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

    // Store metadata for incoming binary audio
    // let pendingAudioMessages = new Map();
    
    ws.on('message', async (message) => {
      try {
        // Check if message is binary data (Buffer)
        // if (message instanceof Buffer) {
        //   // If we have pending audio metadata, process this binary data
        //   if (pendingAudioMessages.has(userId)) {
        //     const audioMetadata = pendingAudioMessages.get(userId);
        //     pendingAudioMessages.delete(userId);
        //     
        //     // Process the binary audio data directly
        //     await processRawAudioData(ws, message, audioMetadata, sessionData);
        //     return;
        //   } else {
        //     console.warn('Received binary data without metadata');
        //     return;
        //   }
        // }
        
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
          // case 'audio_message_metadata':
          //   // Store metadata for the upcoming binary audio data
          //   pendingAudioMessages.set(userId, data);
          //   break;
            
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
            // Base64 encoded audio
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
      // Clean up any active response generations for this user
      if (activeResponseGenerations.has(userId)) {
        console.log(`Cleaning up active response generation for user ${userId}`);
        activeResponseGenerations.delete(userId);
      }
      // Any other cleanup needed for this user's session
    });
  });
  
  console.log('WebSocket handler initialized');
  return wss;
};