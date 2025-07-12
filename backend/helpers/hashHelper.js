const crypto = require('crypto');

/**
 * Generates a hash for a given text string
 * @param {string} text - The text to hash
 * @returns {string} - The hash of the text
 */
function generateHash(text) {
  // Normalize the text by removing extra spaces, converting to lowercase
  const normalizedText = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  // Create a hash of the normalized text
  return crypto.createHash('sha256').update(normalizedText).digest('hex');
}

/**
 * Checks if a response is similar to any in the history based on hash
 * @param {string} response - The response to check
 * @param {Array} chatHistory - Array of previous chat entries
 * @returns {boolean} - True if the response is a duplicate, false otherwise
 */
function isDuplicateResponse(response, chatHistory) {
  if (!response || !chatHistory || chatHistory.length === 0) {
    return false;
  }
  
  // Generate hash for the current response
  const responseHash = generateHash(response);
  
  // Check if this hash exists in any of the previous responses
  return chatHistory.some(entry => entry.responseHash === responseHash);
}

/**
 * Generates alternative response templates to avoid repetition
 * @param {string} originalResponse - The original response that was a duplicate
 * @returns {string} - A template to guide the AI to generate a different response
 */
function getAlternativeTemplate() {
  const templates = [
    "Please provide a different perspective on this topic.",
    "Could you explain this in a different way?",
    "I'd like to hear another approach to this question.",
    "Please rephrase your answer with different examples.",
    "Can you give me an alternative explanation?",
    "I'd appreciate a fresh take on this subject.",
    "Please use a different analogy to explain this concept.",
    "Could you approach this from another angle?",
    "I'd like to explore a different aspect of this topic.",
    "Please provide a more detailed explanation with different points."
  ];
  
  // Select a random template
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = {
  generateHash,
  isDuplicateResponse,
  getAlternativeTemplate
};