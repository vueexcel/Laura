# Laura Frontend Implementation Guide

## Overview

This guide provides instructions for implementing and customizing the Laura AI assistant frontend. The frontend communicates with the Laura backend via WebSocket for real-time audio conversations, leveraging chat history summaries for context-aware responses.

## Quick Start

1. Clone the repository
2. Start the backend server: `node handler.js`
3. Access the WebSocket client at: `http://localhost:8001/api/response/websocket-client`

## WebSocket Client

The repository includes a ready-to-use WebSocket client (`websocket-client.html`) that demonstrates how to:

- Connect to the Laura WebSocket server
- Send text messages
- Record and send audio messages
- Receive and play audio responses
- Display conversation history
- Show emotion detection information

## Audio-Only Mode

The Laura WebSocket API is optimized for audio-only responses, which provides several benefits:

- **Faster Response Times**: By skipping text responses, the server can focus on generating audio
- **Reduced Bandwidth**: Only essential data is transmitted
- **Improved User Experience**: Audio responses feel more natural and conversational

## Frontend Features

### Audio Recording

The frontend includes functionality for recording audio messages:

- Uses the MediaRecorder API for browser-based audio recording
- Converts recordings to base64 for transmission
- Supports the WebM audio format for optimal quality and size

### Audio Playback

Audio responses are automatically played when received:

- Converts base64-encoded audio to playable format
- Provides controls for replaying the last audio response
- Handles various audio formats (mp3 is the default from the server)

### Status Indicators

The UI includes several status indicators:

- Connection status (connected/disconnected)
- Thinking status (when Laura is processing a request)
- Recording status (when audio is being recorded)

## Customizing the Frontend

### Styling

The WebSocket client includes basic CSS styling that you can customize:

```css
/* Main container styles */
.chat-container {
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 70vh;
}

/* Message styles */
.message {
    margin-bottom: 15px;
    padding: 10px 15px;
    border-radius: 18px;
    max-width: 70%;
    word-wrap: break-word;
}

.user-message {
    background-color: #e1f5fe;
    align-self: flex-end;
    margin-left: auto;
}

.assistant-message {
    background-color: #f1f1f1;
    align-self: flex-start;
}
```

### Integrating into Your Application

To integrate the Laura WebSocket client into your own application:

1. Copy the WebSocket connection code
2. Implement the message handling functions
3. Create UI elements for user input and assistant responses
4. Style to match your application's design

#### Core WebSocket Functions

```javascript
// Connect to WebSocket server
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || '8001';
    
    socket = new WebSocket(`${protocol}//${host}:${port}`);
    
    socket.onopen = () => {
        console.log('WebSocket connection established');
        // Update UI to show connected status
        statusDot.classList.remove('offline');
        statusDot.classList.add('connected');
        connectionStatus.textContent = 'Connected';
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        switch(data.type) {
            case 'start_conversation':
                // Handle conversation start
                addStatusMessage('Conversation started');
                break;
                
            case 'audio_response':
                // Handle audio response with emotion data
                handleAudioResponse(data.audio, data.format);
                // You can also use data.emotion for UI changes
                break;
                
            case 'thinking_status':
                // Handle thinking status updates
                handleThinkingStatus(data.thinking);
                break;
                
            case 'transcription':
                // Handle audio transcription results
                addUserMessage(data.text);
                break;
                
            case 'emotion_detected':
                // Handle emotion detection updates
                addStatusMessage(`Emotion detected: ${data.emotion}`);
                break;
                
            case 'error':
                // Handle error messages
                addStatusMessage(`Error: ${data.message}`);
                break;
                
            case 'response_complete':
                // Handle response completion notification
                handleThinkingStatus(false);
                break;
        }
    };
    
    socket.onclose = () => {
        console.log('WebSocket connection closed');
        // Update UI to show disconnected status
        statusDot.classList.remove('connected', 'thinking');
        statusDot.classList.add('offline');
        connectionStatus.textContent = 'Disconnected';
        
        // Implement reconnection logic
        setTimeout(connectWebSocket, 3000); // Try to reconnect after 3 seconds
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Handle connection errors
        addStatusMessage('Connection error. Please try again.');
    };
}
```

## WebSocket Input Types

The frontend can send the following types of input to the WebSocket server:

1. **Text Messages**
   - Format: JSON object with `type`, `userId`, and `message` fields
   - Example: `{type: 'user_message', userId: 'user_id', message: 'Hello Laura'}`

2. **Audio Messages**
   - Format: JSON object with `type`, `userId`, `audio` (base64-encoded), and `format` fields
   - Example: `{type: 'audio_message', userId: 'user_id', audio: 'base64string', format: 'webm'}`

3. **Typing Indicators**
   - Format: JSON object with `type`, `userId`, and `typing` fields
   - Example: `{type: 'typing_indicator', userId: 'user_id', typing: true}`

## Audio Processing

### Recording Audio

The frontend uses the MediaRecorder API to record audio:

```javascript
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            // Process and send the recorded audio
            processAudio();
        };
        
        mediaRecorder.start();
        // Update UI to show recording status
    } catch (error) {
        console.error('Error accessing microphone:', error);
        // Show error message to user
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        // Update UI to show recording stopped
    }
}

function processAudio() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
        // Extract base64 data (remove data URL prefix)
        const base64Audio = reader.result.split(',')[1];
        
        // Send to server
        socket.send(JSON.stringify({
            type: 'audio_message',
            userId: 'user_id', // Replace with actual user ID
            audio: base64Audio,
            format: 'webm'
        }));
    };
}
```

### Playing Audio Responses

```javascript
function playAudio(base64Audio, format) {
    // Convert base64 to blob
    const byteCharacters = atob(base64Audio);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: `audio/${format}` });
    
    // Create URL and play
    const audioUrl = URL.createObjectURL(blob);
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = audioUrl;
    audioPlayer.play();
}
```

## Browser Compatibility

The WebSocket client uses standard web technologies that are supported by modern browsers:

- WebSocket API
- MediaRecorder API for audio recording
- Web Audio API for audio playback

Ensure your target browsers support these technologies. For older browsers, consider adding polyfills or fallback mechanisms.

## Mobile Considerations

When implementing the frontend for mobile devices:

1. Ensure responsive design for different screen sizes
2. Test audio recording on iOS and Android (permissions work differently)
3. Consider battery usage when implementing continuous audio recording
4. Implement touch-friendly UI elements

## Performance Optimization

1. Use efficient audio formats (WebM for recording, MP3 for playback)
2. Implement proper cleanup of audio resources (revoke object URLs when no longer needed)
3. Consider adding a loading indicator during audio processing
4. Optimize CSS for smooth animations and transitions

## Example Implementation

A complete example implementation is available in the `websocket-client.html` file in this repository. Use it as a reference for your own implementation.

## Additional Resources

- See the `WEBSOCKET-API-README.md` file for detailed API documentation
- Check the backend code in `websocket-handler.js` to understand the server-side implementation