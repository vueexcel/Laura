# Laura AI Backend API

This is the backend API for Laura AI, a conversational AI assistant that provides natural language responses and supports audio input/output. The backend is built with Node.js, Express, and uses Firebase Firestore for data storage with vector search capabilities.

## Documentation

Detailed documentation is available in the following files:

- [WebSocket API Documentation](./WEBSOCKET-API-README.md): Details on the WebSocket API endpoints and message formats
- [Frontend Implementation Guide](./FRONTEND-README.md): Guide for implementing and customizing the frontend

## WebSocket API

In addition to the REST API endpoints, Laura supports a WebSocket API for real-time communication, optimized for audio-only responses.

### Audio-Only Mode

The WebSocket API is configured for audio-only responses to optimize performance:

1. Text responses are not sent to the client, reducing bandwidth usage
2. Only audio responses are transmitted, improving response time
3. The server still generates text internally for conversion to audio

### Audio Format

- **Client to Server**: Send audio as base64-encoded WebM format (recommended)
- **Server to Client**: Audio is sent as base64-encoded MP3

### Important Note on Audio Messages

The WebSocket API is designed to handle complete audio messages in a single transmission. There is no need to chunk audio data when sending from the client to the server.

## Features

- **Conversational AI**: Uses OpenAI's GPT-4o model to generate human-like responses
- **Audio Support**: Accepts audio input and provides text-to-speech output
- **Chat History**: Stores conversation history for context and retrieval
- **Vector Search**: Implements semantic search using embeddings for more accurate query results
- **Emotion Memory System**: Tracks and responds to user emotions over time
- **User Behavior Tracking**: Monitors usage patterns to personalize interactions

## API Endpoints

### Generate AI Response

```
POST /api/response/generate
```

**Request:**
- Form data with either:
  - `audio` file (audio recording)
  - `transcribedText` (text input)

**Response:**
```json
{
  "success": true,
  "response": "Text response from AI",
  "emotionTag": "mellow",
  "voiceId": "voice_id_here",
  "id": "chat_entry_id",
  "audio": "base64-encoded audio response"
}
```

### Get Chat History

```
GET /api/response/history
```

**Query Parameters:**
- `limit` (optional): Maximum number of entries to return (default: 10)
- `search` (optional): Semantic search query to find relevant conversations

**Response:**
```json
{
  "success": true,
  "chatHistory": [
    {
      "question": "User question",
      "response": "AI response",
      "createdAt": "timestamp",
      "id": "entry-id"
    }
  ]
}
```

When using semantic search:
```json
{
  "success": true,
  "chatHistory": [
    {
      "question": "User question",
      "response": "AI response",
      "createdAt": "timestamp",
      "id": "entry-id",
      "similarity": 0.92
    }
  ],
  "searchQuery": "your search query"
}
```

### Get Chat Entry Detail

```
GET /api/response/history/:id
```

**Response:**
```json
{
  "success": true,
  "chatEntry": {
    "question": "User question",
    "response": "AI response",
    "createdAt": "timestamp",
    "id": "entry-id"
  }
}
```

### Clear Chat History

```
DELETE /api/response/history
```

**Response:**
```json
{
  "success": true,
  "message": "Chat history cleared successfully"
}
```

### Get User Behavior Tracking

```
GET /api/response/behavior
```

**Response:**
```json
{
  "success": true,
  "usageTracking": {
    "late_night": false,
    "burst_usage": false,
    "session_gap": "3 days",
    "last_open": "2025-07-12T04:45:00Z",
    "open_duration_minutes": 15
  }
}
```

## Vector Search Implementation

The backend uses OpenAI's text-embedding-3-small model to generate vector embeddings for each chat entry. These embeddings are stored in Firestore alongside the chat data, enabling semantic search capabilities.

When a user performs a search with the `search` parameter, the system:

1. Generates embeddings for the search query
2. Calculates cosine similarity between the query embeddings and stored chat entry embeddings
3. Returns the most semantically similar results, sorted by relevance

This allows for more natural and contextual searching beyond simple keyword matching.

## Setup and Installation

### Prerequisites

- Node.js (v14+)
- Firebase project with Firestore enabled
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables in a `.env` file:
   ```
   apiKey=your-openai-api-key
   PORT=3000
   ```
4. Place your Firebase service account key file in the root directory

### Running the Application

Development mode:
```
npm run server
```

Production mode:
```
npm run start
```
