# Voice Comfort API Documentation

## Overview

The Voice Comfort API provides a specialized endpoint for generating calming, soothing responses with breathwork techniques and comforting affirmations. This API is designed to help users manage anxiety, stress, or prepare for sleep by providing gentle guidance and emotional support.

## API Endpoint

### Generate Comfort Response

```
POST /api/voice/comfort
```

#### Request Format

```json
{
  "text": "I'm feeling anxious about my presentation tomorrow."
}
```

| Field | Type   | Description                                       | Required |
|-------|--------|---------------------------------------------------|----------|
| text  | string | The user's message or concern                      | Yes      |

#### Response Format

```json
{
  "success": true,
  "response": "Let's take a moment to breathe together. Inhale for 4 counts, hold for 7, exhale for 8. Again, inhale... hold... and release. You're doing wonderfully, and this moment of peace is yours to keep.",
  "emotionTag": "gentle",
  "voiceId": "KaqFYhsHKkmZFqkEMIX9",
  "id": "1683547896423",
  "audio": "base64_encoded_audio_data"
}
```

| Field      | Type    | Description                                                |
|------------|---------|---------------------------------------------------------|
| success    | boolean | Indicates if the request was successful                   |
| response   | string  | The AI-generated comfort response with breathwork technique|
| emotionTag | string  | The emotional tone of the response (gentle, mellow, tender, whispering, dreamy) |
| voiceId    | string  | The ID of the voice used for text-to-speech conversion   |
| id         | string  | Unique identifier for the chat entry                      |
| audio      | string  | Base64-encoded audio of the spoken response               |

## Error Responses

### Missing Text

```json
{
  "success": false,
  "error": "Text is required in the request body"
}
```

### Server Error

```json
{
  "success": false,
  "error": "Error message details"
}
```

## Testing

You can test the API using the provided test script:

```bash
node test-comfort-api.js
```

This script sends a sample request to the API and logs the response details.

## Implementation Details

- Responses are designed to be calm, gentle, and soothing
- Each response includes a short breathwork technique (like 4-7-8 breathing or box breathing)
- Responses include a comforting affirmation
- All responses are saved to the `aiChats` schema in Firestore
- The API uses the ElevenLabs text-to-speech service to generate audio
- Emotion tags are used to select appropriate voice tones

## Voice Selection

The API automatically selects an appropriate voice based on the emotion tag extracted from the response:

- gentle: KaqFYhsHKkmZFqkEMIX9
- mellow: w57HpPD5nasRV9ph6ReZ
- tender: DZFjiTwNRliN80j2LdP1
- whispering: 20U1b0ROuetSqJPzhcZI
- dreamy: eokRvjNFHIVTv7FPeJ2q

If no matching emotion tag is found, the API defaults to the neutral voice.