# Testing Laura WebSocket API with Postman

## Setting Up Postman for WebSocket Testing

1. **Install Postman**: Download and install the latest version of Postman from [postman.com](https://www.postman.com/downloads/).

2. **Create a New WebSocket Request**:
   - Open Postman
   - Click on "New" button
   - Select "WebSocket Request"

3. **Configure the WebSocket Connection**:
   - Enter the WebSocket URL: `ws://localhost:8001` (or your server address)
   - Click "Connect"

## Testing Different Response Modes

### 1. Text-Only Mode

Send a message with `responseMode` set to `text` to receive only text responses (no audio):

```json
{
  "type": "user_message",
  "userId": "test_user_id",
  "message": "Hello, Laura!",
  "responseMode": "text"
}
```

**Expected Response**:
- You should receive `text_chunk` messages
- You should NOT receive any `audio_chunk` messages
- The final `response_complete` message should include `"responseMode": "text"`

### 2. Audio-Only Mode

Send a message with `responseMode` set to `audio` to receive only audio responses (no text):

```json
{
  "type": "user_message",
  "userId": "test_user_id",
  "message": "Tell me about yourself",
  "responseMode": "audio"
}
```

**Expected Response**:
- You should receive `audio_chunk` messages
- You should NOT receive any `text_chunk` messages
- The final `response_complete` message should include `"responseMode": "audio"`

### 3. Both Text and Audio Mode (Default)

Send a message with `responseMode` set to `both` (or omit it for the default behavior):

```json
{
  "type": "user_message",
  "userId": "test_user_id",
  "message": "What's the weather like?",
  "responseMode": "both"
}
```

**Expected Response**:
- You should receive both `text_chunk` and `audio_chunk` messages
- The final `response_complete` message should include `"responseMode": "both"`

## Testing with Audio Messages

To test audio messages with different response modes, you'll need to:

1. Record audio and convert it to base64
2. Send an audio message with the desired responseMode:

```json
{
  "type": "audio_message",
  "userId": "test_user_id",
  "audio": "[base64_encoded_audio_data]",
  "format": "webm",
  "responseMode": "text"
}
```

## Verifying Persistence of Response Mode

To verify that the response mode persists across messages:

1. Send a message with `responseMode` set to a specific value
2. Send a subsequent message without specifying `responseMode`
3. Confirm that the response follows the previously set mode

## Troubleshooting

- If you're not receiving the expected response type, check the server logs for any warnings or errors
- Verify that your JSON is properly formatted
- Ensure the WebSocket connection is established before sending messages
- Check that the `responseMode` value is one of: `"text"`, `"audio"`, or `"both"`