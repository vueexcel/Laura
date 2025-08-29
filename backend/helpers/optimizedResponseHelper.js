const admin = require('firebase-admin');
const db = admin.firestore(); // Initialize once and reuse

// Cache for frequently used data
const responseCache = new Map();
const fillerCache = new Map();

// Batch processing helper
class MessageBatcher {
    constructor(ws, batchSize = 5, flushInterval = 50) {
        this.ws = ws;
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
        this.queue = [];
        this.timer = null;
    }

    add(message) {
        this.queue.push(message);
        if (this.queue.length >= this.batchSize) {
            this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.flushInterval);
        }
    }

    flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.queue.length > 0) {
            this.ws.send(JSON.stringify({
                type: 'batch',
                messages: this.queue
            }));
            this.queue.length = 0;
        }
    }
}

// Optimized response generation
async function generateOptimizedResponse(message, userId, skipChatSummary = false) {
    const startTime = Date.now();
    let chatSummary = "";

    if (!skipChatSummary) {
        try {
            const chatRef = db.collection('chatSummary').doc(userId);
            const chatDoc = await chatRef.get();
            
            if (chatDoc.exists && chatDoc.data().summary) {
                chatSummary = chatDoc.data().summary;
            }
        } catch (error) {
            console.warn('Skipping chat summary due to error:', error.message);
        }
    }

    // Rest of your response generation logic here...
    
    console.log(`Response generated in ${Date.now() - startTime}ms`);
    return {
        response: responseText,
        emotionTag: responseEmotion
    };
}

module.exports = {
    MessageBatcher,
    generateOptimizedResponse
};
