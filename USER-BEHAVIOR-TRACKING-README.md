# User Behavior Tracking System

## Overview

The User Behavior Tracking System monitors and analyzes user interaction patterns with the Laura application. This system helps personalize Laura's responses based on usage patterns, creating a more adaptive and context-aware conversational experience.

## Features

- **Late-Night Usage Detection**: Identifies when users access the app during late-night hours (12:00 AM to 5:00 AM)
- **Burst Usage Detection**: Recognizes when users open the app multiple times in a short period
- **Session Gap Calculation**: Tracks the time between user sessions
- **Usage History**: Maintains a record of user interaction patterns over time
- **Personalization**: Uses tracking data to adjust Laura's tone and behavior

## Data Structure

The user behavior tracking data is stored in the Firestore database within each user's document in the `aichats` collection. The structure is as follows:

```json
{
  "usageTracking": {
    "late_night": false,
    "burst_usage": false,
    "session_gap": "3 days",
    "last_open": "2025-07-12T04:45:00Z",
    "open_duration_minutes": 15,
    "usage_history": [
      {
        "open_time": "2025-07-09T14:30:00Z",
        "late_night": false,
        "session_gap": "1 days"
      },
      {
        "open_time": "2025-07-12T04:45:00Z",
        "late_night": true,
        "session_gap": "3 days"
      }
    ]
  }
}
```

### Fields Explanation

- **late_night**: Boolean flag indicating if the app was opened during late-night hours (12:00 AM to 5:00 AM)
- **burst_usage**: Boolean flag indicating if the app was opened more than 3 times within a 1-hour period
- **session_gap**: String representing the time gap between the current and previous sessions in days
- **last_open**: ISO timestamp of the most recent app open time
- **open_duration_minutes**: Estimated duration of the session in minutes, calculated based on the average duration of recent sessions
- **usage_history**: Array of historical usage data, limited to the last 50 entries

## API Endpoints

### Update User Behavior Tracking

The user behavior tracking is automatically updated whenever the user interacts with the `/api/response/generate` endpoint, but the tracking data is not included in the response.

```
POST /api/response/generate
```

The response format:

```json
{
  "success": true,
  "response": "Laura's response text",
  "emotionTag": "mellow",
  "voiceId": "voice_id_here",
  "id": "chat_entry_id",
  "audio": "base64_audio_data"
}
```

### Get User Behavior Tracking

Retrieve the current user behavior tracking data.

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

## Implementation Details

### Late-Night Usage Detection

The system checks the current time when the app is opened. If the hour is between 0 (12:00 AM) and 5 (5:00 AM), the `late_night` flag is set to `true`.

### Burst Usage Detection

The system tracks app opens in the usage history. If there are more than 3 opens within a 1-hour period, the `burst_usage` flag is set to `true`.

### Session Gap Calculation

The system calculates the difference in days between the current open time and the last recorded open time, storing it as a string in the format "X days".

### Usage History

Each time the app is opened, a new entry is added to the `usage_history` array with the current timestamp, late-night status, session gap, and duration minutes. The history is limited to the last 50 entries to prevent excessive data storage.

### Open Duration Minutes Calculation

The `open_duration_minutes` field is calculated based on real usage data:

1. For new users with no history, a default value of 10 minutes is used
2. For returning users, the system calculates the average duration of the last 5 sessions
3. If there are fewer than 5 previous sessions, it uses all available session data
4. Each session's duration is stored in the usage history for future calculations
5. This approach ensures that the duration estimate improves over time as more usage data is collected

## Integration with Laura's Behavior

The user behavior tracking data can be used to personalize Laura's responses in several ways:

1. **Late-Night Conversations**: When `late_night` is true, Laura can adopt a more subdued, calming tone
2. **Burst Usage Patterns**: When `burst_usage` is true, Laura can acknowledge the user's frequent engagement
3. **Session Gaps**: Based on the `session_gap` value, Laura can reference the time since the last conversation

These contextual cues help create a more natural and personalized conversation experience, making Laura feel more responsive to the user's habits and patterns.