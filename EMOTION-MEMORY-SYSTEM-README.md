# Laura's Emotion Memory System

## Overview

This document describes the implementation of Laura's emotion memory system, which tracks and responds to the emotional state of users over time. The system persistently stores emotional data in Firestore and uses it to influence Laura's response tone and voice style.

## Features

- **Persistent Emotion Tracking**: Maintains emotional state across sessions
- **Multi-dimensional Emotion Model**: Tracks multiple emotions with intensity scores
- **Adaptive Responses**: Adjusts Laura's tone based on the user's emotional state
- **Emotion Analysis**: Uses OpenAI to analyze text for emotional content
- **Emotion-Aware Prompts**: Enhances system prompts with emotional context

## Implementation Details

### Emotion State Structure

The emotion state is stored as a JSON object in Firestore with the following structure:

```json
{
  "emotionState": {
    "fatigue": 0.2,
    "stress": 0.2,
    "joy": 0.2,
    "withdrawn": 0.2,
    "talkative": 0.2,
    "anxiety": 0.2,
    "excitement": 0.2,
    "sadness": 0.2,
    "anger": 0.2,
    "frustration": 0.2,
    "confusion": 0.2,
    "curiosity": 0.2,
    "hope": 0.2,
    "gratitude": 0.2,
    "confidence": 0.2,
    "lastUpdated": "2023-07-10T10:43:00Z"
  }
}
```

Each emotion has a score between 0.0 and 1.0, representing its intensity. The `lastUpdated` field stores the timestamp of the last update.

### Key Components

#### 1. Emotion Memory Helper (`emotionMemoryHelper.js`)

This module provides the core functionality for the emotion memory system:

- `getEmotionState(userId)`: Retrieves the current emotion state for a user
- `updateEmotionState(userId, text, emotionTag)`: Updates the emotion state based on user input and/or response emotion tag
- `getEmotionAwarePrompt(userId, basePrompt)`: Enhances a system prompt with emotional context

#### 2. Integration with Response Generation

The emotion memory system is integrated with the following API endpoints:

- `/api/response/generate`: Text-only responses
- `/api/voice/comfort`: Voice comfort responses

Both endpoints now update the emotion state based on user input, generate emotion-aware responses, and include the current emotion state in the API response.

### Database Changes

The emotion state is stored in the `aichats` collection in Firestore, alongside the chat history. Each user document now includes an `emotionState` field with the emotion state structure described above.

## API Response Format

API responses now include an `emotionState` field with the current emotion state:

```json
{
  "response": "Laura's response text",
  "emotionState": {
    "fatigue": 0.2,
    "stress": 0.3,
    "joy": 0.7,
    "withdrawn": 0.1,
    "talkative": 0.6,
    "anxiety": 0.2,
    "excitement": 0.5,
    "sadness": 0.1,
    "anger": 0.0,
    "frustration": 0.1,
    "confusion": 0.0,
    "curiosity": 0.4,
    "hope": 0.6,
    "gratitude": 0.5,
    "confidence": 0.7,
    "lastUpdated": "2023-07-10T10:43:00Z"
  }
}
```

## Testing

A test script (`test-emotion-memory.js`) is provided to verify the emotion memory system implementation. The script sends a series of messages with different emotional tones and logs the responses, including the emotion state.

To run the test:

```bash
node test-emotion-memory.js
```

## Future Enhancements

- **Emotion Visualization**: Add a frontend component to visualize the emotion state over time
- **Fine-tuned Emotion Analysis**: Train a custom model for more accurate emotion detection
- **Contextual Emotion Adjustment**: Adjust emotion analysis based on conversation context
- **User Feedback Loop**: Allow users to provide feedback on Laura's emotional understanding
- **Multi-modal Emotion Detection**: Incorporate voice tone and facial expression analysis

## Technical Notes

- The emotion memory system uses OpenAI's GPT-4 model for emotion analysis
- Emotion scores decay slightly over time (5% per interaction) for emotions not explicitly updated
- The system prompt is enhanced with emotional context to guide the response generation
- Emotion tags from responses are used to further refine the emotion state