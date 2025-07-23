# Laura WebSocket API

## Overview

The Laura WebSocket API provides real-time communication between clients and the Laura AI assistant. This API is optimized for audio-based conversations, allowing users to send text or audio messages and receive audio responses from Laura.

## Features

- **Audio-Only Mode**: Optimized for fast responses by skipping text responses and only sending audio
- **Real-time Communication**: WebSocket protocol for instant messaging
- **Audio Message Support**: Send audio recordings for transcription and processing
- **Emotion Detection**: Includes emotion tags with responses for voice modulation

## Connection

Connect to the WebSocket server at:

```
ws://[hostname]:[port]
```

For secure connections:

```
wss://[hostname]:[port]
```

The default port is `8001`.

## Message Types

### Client to Server

#### Text Message

```json
{
  "type": "user_message",
  "userId": "[user_id]",
  "message": "Hello, Laura!",
  "responseMode": "both" // Optional: 'text', 'audio', or 'both' (default)
}
```

Alternatively, you can use:

```json
{
  "type": "message",
  "userId": "[user_id]",
  "text": "Hello, Laura!",
  "responseMode": "both" // Optional: 'text', 'audio', or 'both' (default)
}
```

**Response Mode Options:**

- `text`: Laura will respond with text only (no audio)
- `audio`: Laura will respond with audio only (no text)
- `both`: Laura will respond with both text and audio (default)

#### Audio Message

```json
{
  "type": "audio_message",
  "userId": "[user_id]",
  "audio": "[base64_encoded_audio]",
  "format": "webm",
  "responseMode": "both" // Optional: 'text', 'audio', or 'both' (default)
}
```

**Important Notes for Audio Messages:**

- Audio must be base64 encoded
- Supported formats: webm (recommended), mp3, wav
- No need to chunk audio - send the complete recording in a single message

### Server to Client

#### Start Conversation

```json
{
  "type": "start_conversation",
  "userId": "[user_id]"
}
```

#### Audio Response

```json
{
  "type": "audio_response",
  "audio": "[base64_encoded_audio]",
  "format": "mp3",
  "emotion": "[emotion_tag]"
}
```

#### Emotion Detected

```json
{
  "type": "emotion_detected",
  "emotion": "[emotion_tag]"
}
```

#### Thinking Status

```json
{
  "type": "thinking_status",
  "isThinking": true|false
}
```

#### Transcription

```json
{
  "type": "transcription",
  "text": "[transcribed_text]"
}
```

#### Response Complete

```json
{
  "type": "response_complete",
  "messageId": "[message_id]",
  "emotion": "neutral",
  "responseMode": "both" // The response mode that was used: 'text', 'audio', or 'both'
}
```

#### Error

```json
{
  "type": "error",
  "message": "[error_message]"
}
```

## Frontend Implementation Guide

### Connecting to the WebSocket

```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.hostname;
const port = window.location.port || '8001';

const socket = new WebSocket(`${protocol}//${host}:${port}`);

socket.onopen = () => {
  console.log('Connected to Laura WebSocket');
};

socket.onclose = () => {
  console.log('Disconnected from Laura WebSocket');
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### Handling Messages

```javascript
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'audio_response':
      // Convert base64 to audio and play
      playAudio(data.audio, data.format);
      break;
      
    case 'thinking_status':
      // Update UI to show thinking status
      updateThinkingStatus(data.isThinking);
      break;
      
    case 'transcription':
      // Display transcribed text
      displayTranscription(data.text);
      break;
      
    case 'emotion_detected':
      // Optionally use emotion information
      console.log('Emotion:', data.emotion);
      break;
      
    case 'error':
      // Handle error
      displayError(data.message);
      break;
      
    case 'response_complete':
      // Response is complete
      break;
  }
};
```

### Sending Text Messages

```javascript
function sendTextMessage(message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'user_message',
      userId: 'user_id',
      message: message
    }));
  }
}
```

### Recording and Sending Audio

```javascript
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const audioChunks = [];
  
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
  
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      // Extract base64 data (remove data URL prefix)
      const base64Audio = reader.result.split(',')[1];
      
      // Send to server
      socket.send(JSON.stringify({
        type: 'audio_message',
        userId: 'user_id',
        audio: base64Audio,
        format: 'webm'
      }));
    };
  };
  
  mediaRecorder.start();
  return mediaRecorder;
}

function stopRecording(mediaRecorder) {
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(track => track.stop());
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

## Performance Considerations

### Audio-Only Mode

The WebSocket API is configured for audio-only responses to optimize performance. This means:

1. Text responses are not sent to the client, reducing bandwidth usage
2. Only audio responses are transmitted, improving response time
3. The server still generates text internally for conversion to audio

### Audio Format Recommendations

- For sending audio to the server: Use `webm` format for best quality/size ratio
- For receiving audio: The server sends audio in `mp3` format

## Error Handling

Implement proper error handling for WebSocket connections:

1. Handle connection errors and implement reconnection logic
2. Process error messages from the server
3. Implement timeouts for operations that might hang

## Example Implementation

A complete example implementation is available in the `websocket-client.html` file in this repository.

## Server Configuration

The WebSocket server runs on port 8001 by default. To change this, modify the port in `handler.js`.

## Security Considerations

In a production environment:

1. Use secure WebSocket connections (WSS)
2. Implement proper authentication
3. Add rate limiting to prevent abuse
4. Consider adding message validation