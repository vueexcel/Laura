# Diary Entry API Documentation

This document outlines the APIs for managing user diary entries in the Laura Backend system. These entries are stored in Firestore and provide functionality for creating, editing, and retrieving diary entries.

## Data Structure

Each diary entry contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| userId | String | Unique identifier for the user |
| date | String | Date of the entry in YYYY-MM-DD format |
| title | String | Title of the diary entry |
| body | String | Text content of the diary |
| createdAt | Timestamp | When the entry was created |
| updatedAt | Timestamp | When the entry was last modified |

## API Endpoints

### 1. Create Diary Entry

**Endpoint:** `POST /api/diary/create`

**Authentication:** Required

**Request Body:**

```json
{
  "userId": "abc123",
  "date": "2025-07-22",
  "title": "My Diary Title",
  "body": "The text content of the diary."
}
```

**Response:**

```json
{
  "status": 201,
  "message": "Diary entry created successfully",
  "data": {
    "entryId": "xyz789",
    "userId": "abc123",
    "date": "2025-07-22",
    "title": "My Diary Title",
    "body": "The text content of the diary.",
    "createdAt": "2025-07-22T12:00:00.000Z",
    "updatedAt": "2025-07-22T12:00:00.000Z"
  }
}
```

### 2. Edit Diary Entry

**Endpoint:** `PUT /api/diary/edit/:entryId`

**Authentication:** Required

**URL Parameters:**
- `entryId`: The ID of the diary entry to edit

**Request Body:**

```json
{
  "title": "Updated Title",
  "body": "Updated diary content."
}
```

**Response:**

```json
{
  "status": 200,
  "message": "Diary entry updated successfully",
  "data": {
    "entryId": "xyz789",
    "userId": "abc123",
    "date": "2025-07-22",
    "title": "Updated Title",
    "body": "Updated diary content.",
    "createdAt": "2025-07-22T12:00:00.000Z",
    "updatedAt": "2025-07-22T12:30:00.000Z"
  }
}
```

### 3. Get User Diary Entries

**Endpoint:** `GET /api/diary/user/:userId`

**Authentication:** Required

**URL Parameters:**
- `userId`: The ID of the user whose diary entries to retrieve

**Query Parameters (optional):**
- `startDate`: Filter entries from this date (YYYY-MM-DD)
- `endDate`: Filter entries until this date (YYYY-MM-DD)

**Example Request:**
```
GET /api/diary/user/abc123?startDate=2025-01-01&endDate=2025-01-31
```

**Response:**

```json
{
  "status": 200,
  "message": "Diary entries retrieved successfully",
  "data": [
    {
      "entryId": "xyz789",
      "userId": "abc123",
      "date": "2025-01-17",
      "title": "My Feelings",
      "body": "Today felt heavier than usual...",
      "createdAt": "2025-01-17T12:00:00.000Z",
      "updatedAt": "2025-01-17T12:00:00.000Z"
    },
    {
      "entryId": "abc456",
      "userId": "abc123",
      "date": "2025-01-15",
      "title": "A Good Day",
      "body": "Today was wonderful...",
      "createdAt": "2025-01-15T12:00:00.000Z",
      "updatedAt": "2025-01-15T12:00:00.000Z"
    }
  ]
}
```

## Implementation Notes

- Diary entries are stored in the `diaryEntries` collection in Firestore
- Entries are tied to a date and can be displayed in a calendar-style view
- Date is stored as a string in YYYY-MM-DD format for easier frontend filtering
- Entries are returned sorted by date (newest first)
- Authentication middleware ensures only authorized users can access the APIs