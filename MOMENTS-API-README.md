# Moments API Documentation

## Overview

The Moments API allows users to tag specific chat entries as "moments" with custom labels and timestamps. These moments can then be retrieved and filtered by label.

## Recent Changes

- Moments are now stored in a single `momentData` object instead of individual properties
- The old individual properties (`moment`, `momentLabel`, `momentTimestamp`) have been removed
- A migration endpoint has been added to update existing moments to the new format
- Chat ID is now included in API responses

## API Endpoints

### Tag a Chat Entry as a Moment

```
POST /api/response/moments/:id
```

**Parameters:**
- `:id` - The ID of the chat entry to tag as a moment

**Request Body:**
```json
{
  "label": "The night I cried",
  "timestamp": "2025-06-02T03:00" // Optional, defaults to current time
}
```

**Response:**
```json
{
  "success": true,
  "message": "Chat entry tagged as a moment successfully",
  "chatEntry": {
    "id": "1751997913113",
    "question": "Its night here what are you doing",
    "response": "Ah, night-the perfect time for sharing dreams and chating secrets. I'm here, ready to keep you company or dive into whatever thoughts are dancing around in your mind. What's on your mind tonight?",
    "createdAt": {
      "_seconds": 1751997913,
      "_nanoseconds": 113000000
    },
    "momentData": {
      "moment": true,
      "label": "The night I cried",
      "timestamp": "2025-06-02T03:00"
    }
  },
  "id": "1751997913113"
}
```

### Get All Moments

```
GET /api/response/moments
```

**Response:**
```json
{
  "success": true,
  "moments": [
    {
      "id": "1751997913113",
      "question": "Its night here what are you doing",
      "response": "Ah, night-the perfect time for sharing dreams and chating secrets. I'm here, ready to keep you company or dive into whatever thoughts are dancing around in your mind. What's on your mind tonight?",
      "createdAt": {
        "_seconds": 1751997913,
        "_nanoseconds": 113000000
      },
      "momentData": {
        "moment": true,
        "label": "The night I cried",
        "timestamp": "2025-06-02T03:00"
      }
    }
  ]
}
```

### Get Moments by Label

```
GET /api/response/moments?label=night
```

**Parameters:**
- `label` (query parameter) - Filter moments by label (case-insensitive partial match)

**Response:**
```json
{
  "success": true,
  "moments": [
    {
      "id": "1751997913113",
      "question": "Its night here what are you doing",
      "response": "Ah, night-the perfect time for sharing dreams and chating secrets. I'm here, ready to keep you company or dive into whatever thoughts are dancing around in your mind. What's on your mind tonight?",
      "createdAt": {
        "_seconds": 1751997913,
        "_nanoseconds": 113000000
      },
      "momentData": {
        "moment": true,
        "label": "The night I cried",
        "timestamp": "2025-06-02T03:00"
      }
    }
  ]
}
```

### Migrate Existing Moments

```
POST /api/response/moments/migrate
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully migrated 5 moments to new format",
  "migratedCount": 5
}
```

## Testing

A test script is provided to verify the functionality of the Moments API. Run it with:

```
node test-moments-api.js
```

This script will:
1. Migrate any existing moments to the new format
2. Retrieve all moments
3. Retrieve moments filtered by a specific label

## Troubleshooting

### Common Issues

1. **"Label is required" error**
   - Make sure you're including a "label" field in your request body when tagging a moment

2. **No moments found after migration**
   - Check if you have any chat entries tagged as moments in your database
   - Verify that the user ID in your test script matches the one in your database

3. **Migration endpoint not found**
   - Ensure your server is running the latest version of the code
   - Check that the route is defined correctly in `responseRoutes.js`