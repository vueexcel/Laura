# Generate API Documentation

## Overview

The Generate API is the core endpoint for interacting with the Laura AI assistant. It accepts user input (either as text or audio) and returns an AI-generated response along with emotion tags, voice ID, and audio.

## Recent Changes

- Chat ID is now included in the API response
- This allows for easier tracking and referencing of chat entries

## API Endpoint

```
POST /api/response/generate
```

### Request

The API accepts either text input or audio file upload.

**Option 1: Text Input**

```json
{
  "transcribedText": "I am feeling good"
}
```

**Option 2: Audio File Upload**

Use `multipart/form-data` with an audio file in the `audio` field.

### Response

```json
{
  "success": true,
  "response": "That's wonderful to hear! When you're feeling good, the possibilities seem endless, don't they? What are you most excited about right now? 🌞",
  "emotionTag": "Playful/cheeky",
  "voiceId": "OHIUUjUfuKZcYRQX2S7b",
  "id": "1685432198765",
  "audio": "base64-encoded-audio-data"
}
```

### Response Fields

- `success`: Boolean indicating if the request was successful
- `response`: The text response from Laura
- `emotionTag`: The emotional tone of the response
- `voiceId`: The ID of the voice used for audio generation
- `id`: The unique chat entry ID (new field)
- `audio`: Base64-encoded audio of the response

## Testing

A test script is provided to verify the functionality of the Generate API. Run it with:

```
node test-generate-api.js
```

This script will:
1. Send a test message to the Generate API
2. Display the response including the chat ID
3. Verify that the chat ID is included in the response

## Using the Chat ID

The chat ID can be used for:

1. **Referencing specific chat entries** - Use the ID to retrieve a specific chat entry using the `/api/response/history/:id` endpoint

2. **Tagging moments** - Use the ID to tag a chat entry as a moment using the `/api/response/moments/:id` endpoint

3. **Client-side tracking** - Store the ID on the client side to reference specific conversations

## Error Handling

If an error occurs, the API will return a response with `success: false` and an error message:

```json
{
  "success": false,
  "error": "Error message details"
}
```

Common errors include:
- Missing input (no text or audio provided)
- Audio transcription failures
- AI response generation failures