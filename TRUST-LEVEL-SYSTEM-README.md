# Laura's Trust Level System

## Overview

The Trust Level System is a feature that enables Laura to develop a more natural relationship progression with users over time. As users interact with Laura, the system tracks various aspects of their behavior and conversation patterns to determine an appropriate level of trust and familiarity, which in turn influences Laura's conversational style and boundaries.

## Trust Levels

The system defines five distinct trust levels that represent the progression of the relationship between Laura and the user:

1. **Stranger (0-19 points)**: Initial level for new users. Laura maintains appropriate boundaries and avoids overly personal topics unless initiated by the user.

2. **Acquaintance (20-39 points)**: Basic familiarity established. Laura can reference previous conversations occasionally and show a bit more personality.

3. **Friend (40-59 points)**: Regular interaction and rapport developed. Laura can be more casual, show more personality, and reference shared experiences from previous conversations.

4. **Confidant (60-79 points)**: Deeper connection and trust established. Laura can be more personal and empathetic, reference deeper topics from previous conversations, and show genuine concern for the user's wellbeing.

5. **Intimate (80-100 points)**: Highest level of trust and connection. Laura can be very personal, show her full personality, reference intimate details from previous conversations, and demonstrate deep empathy and understanding.

## Trust Factors

The trust level is calculated based on four key factors, each contributing up to 25 points to the overall trust score:

1. **Consistency**: Rewards regular usage patterns. Users who interact with Laura on a consistent basis (daily or every few days) will see this factor increase.

2. **Engagement**: Measures the depth and quality of interactions. Longer, more detailed messages from the user contribute to higher engagement scores.

3. **Vulnerability**: Tracks the sharing of personal information and emotions. When users discuss their feelings or personal situations, this factor increases.

4. **Longevity**: Accounts for the overall duration of the relationship. As users accumulate more interactions over time, this factor gradually increases.

## Data Structure

The trust level data is stored in the Firestore database within each user's document in the `aichats` collection. The structure is as follows:

```json
{
  "trustLevel": {
    "level": 40,
    "levelName": "Friend",
    "points": 45,
    "lastUpdated": "2023-07-15T14:30:00Z",
    "milestones": [
      {
        "level": 20,
        "levelName": "Acquaintance",
        "date": "2023-06-01T10:15:00Z",
        "points": 22
      },
      {
        "level": 40,
        "levelName": "Friend",
        "date": "2023-07-15T14:30:00Z",
        "points": 45
      }
    ],
    "factors": {
      "consistency": 15,
      "engagement": 12,
      "vulnerability": 8,
      "longevity": 10
    }
  }
}
```

### Fields Explanation

- **level**: Numeric value representing the current trust level (0, 20, 40, 60, or 80)
- **levelName**: String name of the current trust level (Stranger, Acquaintance, Friend, Confidant, or Intimate)
- **points**: Total trust points (0-100) accumulated
- **lastUpdated**: ISO timestamp of when the trust level was last updated
- **milestones**: Array of significant trust level changes, including the level, name, date, and points at the time of achievement
- **factors**: Object containing the current value (0-25) for each of the four trust factors

## API Endpoints

### Get Trust Level

Retrieve the current trust level data for a user.

```
GET /api/response/trust-level
```

**Response:**

```json
{
  "success": true,
  "trustLevel": {
    "level": 40,
    "levelName": "Friend",
    "points": 45,
    "lastUpdated": "2023-07-15T14:30:00Z",
    "milestones": [...],
    "factors": {...}
  }
}
```

## Implementation Details

### Trust Level Calculation

The trust level is automatically updated after each interaction with Laura. The system analyzes the user's behavior patterns and conversation history to adjust the four trust factors, which in turn determine the overall trust level.

### Integration with Laura's Behavior

The trust level information is incorporated into Laura's system prompt, allowing her to adjust her conversational style and boundaries based on the current relationship stage. This creates a more natural progression of familiarity and intimacy over time, similar to how human relationships develop.

### Trust Level Milestones

When a user reaches a new trust level, the system records this achievement as a milestone. These milestones provide a history of the relationship's progression and could potentially be used to acknowledge significant relationship developments in future conversations.

## Technical Implementation

The trust level system is implemented in the following files:

- **trustLevelHelper.js**: Contains the core functionality for managing trust levels, including functions to get and update trust levels, calculate trust factors, and generate trust-aware system prompts.

- **firestoreHelper.js**: Integrates the trust level system with the response generation process, updating trust levels after each interaction and incorporating trust level information into the system prompt.

- **responseController.js**: Provides an API endpoint for retrieving trust level data.

## Testing

A test script (`test-trust-level.js`) is provided to verify the trust level functionality. This script simulates multiple interactions with Laura and checks how the trust level changes in response.