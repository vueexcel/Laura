/**
 * Trust Level Helper Module
 * 
 * This module manages the trust level system for Laura AI, which tracks and updates
 * a user's trust level based on their interaction patterns and usage behavior.
 */

const admin = require('firebase-admin');

// Get Firestore instance from the initialized app
const db = admin.firestore();

// Trust level thresholds
const TRUST_LEVELS = {
  STRANGER: 0,      // 0-19: Initial level for new users
  ACQUAINTANCE: 20, // 20-39: Basic familiarity established
  FRIEND: 40,       // 40-59: Regular interaction and rapport
  CONFIDANT: 60,    // 60-79: Deeper connection and trust
  INTIMATE: 80      // 80-100: Highest level of trust and connection
};

// Trust level names for reference
const TRUST_LEVEL_NAMES = {
  0: 'Stranger',
  20: 'Acquaintance',
  40: 'Friend',
  60: 'Confidant',
  80: 'Intimate'
};

/**
 * Get the current trust level data for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The trust level data
 */
async function getTrustLevel(userId) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    // Default trust level structure
    const defaultTrustData = {
      level: TRUST_LEVELS.STRANGER,
      levelName: TRUST_LEVEL_NAMES[TRUST_LEVELS.STRANGER],
      points: 0,
      lastUpdated: new Date().toISOString(),
      milestones: [],
      factors: {
        consistency: 0,
        engagement: 0,
        vulnerability: 0,
        longevity: 0
      }
    };
    
    if (!userDoc.exists || !userDoc.data().trustLevel) {
      return defaultTrustData;
    }
    
    return userDoc.data().trustLevel;
  } catch (error) {
    console.error('Error retrieving trust level:', error);
    throw new Error('Failed to retrieve trust level: ' + error.message);
  }
}

/**
 * Calculate the trust level name based on points
 * @param {number} points - Trust points (0-100)
 * @returns {string} - Trust level name
 */
function calculateTrustLevelName(points) {
  if (points >= TRUST_LEVELS.INTIMATE) return TRUST_LEVEL_NAMES[TRUST_LEVELS.INTIMATE];
  if (points >= TRUST_LEVELS.CONFIDANT) return TRUST_LEVEL_NAMES[TRUST_LEVELS.CONFIDANT];
  if (points >= TRUST_LEVELS.FRIEND) return TRUST_LEVEL_NAMES[TRUST_LEVELS.FRIEND];
  if (points >= TRUST_LEVELS.ACQUAINTANCE) return TRUST_LEVEL_NAMES[TRUST_LEVELS.ACQUAINTANCE];
  return TRUST_LEVEL_NAMES[TRUST_LEVELS.STRANGER];
}

/**
 * Calculate the trust level based on points
 * @param {number} points - Trust points (0-100)
 * @returns {number} - Trust level value
 */
function calculateTrustLevel(points) {
  if (points >= TRUST_LEVELS.INTIMATE) return TRUST_LEVELS.INTIMATE;
  if (points >= TRUST_LEVELS.CONFIDANT) return TRUST_LEVELS.CONFIDANT;
  if (points >= TRUST_LEVELS.FRIEND) return TRUST_LEVELS.FRIEND;
  if (points >= TRUST_LEVELS.ACQUAINTANCE) return TRUST_LEVELS.ACQUAINTANCE;
  return TRUST_LEVELS.STRANGER;
}

/**
 * Update the trust level based on user behavior and interactions
 * @param {string} userId - The user ID
 * @param {Object} usageTracking - User behavior tracking data
 * @param {Object} chatData - Recent chat data for analysis
 * @returns {Promise<Object>} - The updated trust level data
 */
async function updateTrustLevel(userId, usageTracking, chatData = null) {
  try {
    // Get current trust level
    const currentTrustData = await getTrustLevel(userId);
    
    // Calculate trust factors
    const factors = calculateTrustFactors(usageTracking, chatData, currentTrustData);
    
    // Calculate new trust points
    let newPoints = Math.min(100, Math.max(0, (
      currentTrustData.points + 
      factors.consistencyChange + 
      factors.engagementChange + 
      factors.vulnerabilityChange + 
      factors.longevityChange
    )));
    
    // Round to nearest integer
    newPoints = Math.round(newPoints);
    
    // Determine if level changed
    const oldLevel = currentTrustData.level;
    const newLevel = calculateTrustLevel(newPoints);
    const levelChanged = oldLevel !== newLevel;
    
    // Create milestone if level changed
    let milestones = [...currentTrustData.milestones];
    if (levelChanged && newLevel > oldLevel) {
      milestones.push({
        level: newLevel,
        levelName: calculateTrustLevelName(newPoints),
        date: new Date().toISOString(),
        points: newPoints
      });
    }
    
    // Create updated trust data
    const updatedTrustData = {
      level: newLevel,
      levelName: calculateTrustLevelName(newPoints),
      points: newPoints,
      lastUpdated: new Date().toISOString(),
      milestones: milestones,
      factors: {
        consistency: factors.consistency,
        engagement: factors.engagement,
        vulnerability: factors.vulnerability,
        longevity: factors.longevity
      }
    };
    
    // Update in Firestore
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      trustLevel: updatedTrustData
    });
    
    return updatedTrustData;
  } catch (error) {
    console.error('Error updating trust level:', error);
    throw new Error('Failed to update trust level: ' + error.message);
  }
}

/**
 * Calculate trust factors based on user behavior and interactions
 * @param {Object} usageTracking - User behavior tracking data
 * @param {Object} chatData - Recent chat data for analysis
 * @param {Object} currentTrustData - Current trust level data
 * @returns {Object} - Updated trust factors and changes
 */
function calculateTrustFactors(usageTracking, chatData, currentTrustData) {
  // Initialize factors with current values
  const factors = {
    consistency: currentTrustData.factors.consistency,
    engagement: currentTrustData.factors.engagement,
    vulnerability: currentTrustData.factors.vulnerability,
    longevity: currentTrustData.factors.longevity,
    consistencyChange: 0,
    engagementChange: 0,
    vulnerabilityChange: 0,
    longevityChange: 0
  };
  
  // Calculate consistency factor (regular usage patterns)
  if (usageTracking && usageTracking.usage_history) {
    // Check for regular usage patterns in the last 10 sessions
    const recentHistory = usageTracking.usage_history.slice(-10);
    
    if (recentHistory.length >= 3) {
      // Calculate average gap between sessions
      let totalGapDays = 0;
      let gapCount = 0;
      
      for (let i = 1; i < recentHistory.length; i++) {
        const currentDate = new Date(recentHistory[i].open_time);
        const prevDate = new Date(recentHistory[i-1].open_time);
        const diffDays = Math.abs((currentDate - prevDate) / (1000 * 60 * 60 * 24));
        
        totalGapDays += diffDays;
        gapCount++;
      }
      
      const avgGapDays = gapCount > 0 ? totalGapDays / gapCount : 0;
      
      // Reward consistent usage (lower average gap)
      if (avgGapDays <= 1) { // Daily usage
        factors.consistencyChange = 0.5;
      } else if (avgGapDays <= 3) { // Every few days
        factors.consistencyChange = 0.3;
      } else if (avgGapDays <= 7) { // Weekly usage
        factors.consistencyChange = 0.1;
      } else {
        factors.consistencyChange = 0;
      }
      
      // Penalize very inconsistent usage but only slightly
      if (avgGapDays > 14) {
        factors.consistencyChange = -0.1;
      }
    }
    
    // Update consistency factor
    factors.consistency = Math.min(25, Math.max(0, factors.consistency + factors.consistencyChange));
  }
  
  // Calculate engagement factor (depth and quality of interactions)
  if (chatData && chatData.chat && chatData.chat.length > 0) {
    const recentChats = chatData.chat.slice(-5);
    let totalMessageLength = 0;
    let messageCount = 0;
    
    for (const chat of recentChats) {
      if (chat.question) {
        totalMessageLength += chat.question.length;
        messageCount++;
      }
    }
    
    const avgMessageLength = messageCount > 0 ? totalMessageLength / messageCount : 0;
    
    // Reward more engaged conversations (longer messages)
    if (avgMessageLength >= 100) { // Very detailed messages
      factors.engagementChange = 0.5;
    } else if (avgMessageLength >= 50) { // Moderately detailed
      factors.engagementChange = 0.3;
    } else if (avgMessageLength >= 20) { // Short but meaningful
      factors.engagementChange = 0.1;
    } else {
      factors.engagementChange = 0;
    }
    
    // Update engagement factor
    factors.engagement = Math.min(25, Math.max(0, factors.engagement + factors.engagementChange));
  }
  
  // Calculate vulnerability factor (sharing personal information)
  // This is a placeholder - in a real implementation, this would use
  // sentiment analysis or topic detection to identify personal sharing
  if (chatData && chatData.chat && chatData.chat.length > 0) {
    // For now, we'll use a simple heuristic based on emotional content
    // A more sophisticated implementation would analyze actual content
    const recentChats = chatData.chat.slice(-10);
    let emotionalContentCount = 0;
    
    for (const chat of recentChats) {
      // Check if the message contains emotional keywords
      const emotionalKeywords = ['feel', 'feeling', 'felt', 'emotion', 'sad', 'happy', 'angry', 'afraid', 'scared', 'anxious', 'worried', 'love', 'hate', 'fear'];
      
      if (chat.question && typeof chat.question === 'string') {
        const lowerCaseQuestion = chat.question.toLowerCase();
        if (emotionalKeywords.some(keyword => lowerCaseQuestion.includes(keyword))) {
          emotionalContentCount++;
        }
      }
    }
    
    // Calculate vulnerability change based on emotional content
    const vulnerabilityRatio = recentChats.length > 0 ? emotionalContentCount / recentChats.length : 0;
    
    if (vulnerabilityRatio >= 0.3) { // 30% or more messages contain emotional content
      factors.vulnerabilityChange = 0.4;
    } else if (vulnerabilityRatio >= 0.1) { // 10% or more
      factors.vulnerabilityChange = 0.2;
    } else {
      factors.vulnerabilityChange = 0;
    }
    
    // Update vulnerability factor
    factors.vulnerability = Math.min(25, Math.max(0, factors.vulnerability + factors.vulnerabilityChange));
  }
  
  // Calculate longevity factor (account age and total interactions)
  if (usageTracking && usageTracking.usage_history) {
    const historyLength = usageTracking.usage_history.length;
    
    // Reward based on total number of interactions
    if (historyLength >= 50) { // Long-term user
      factors.longevityChange = 0.5;
    } else if (historyLength >= 20) { // Established user
      factors.longevityChange = 0.3;
    } else if (historyLength >= 10) { // Regular user
      factors.longevityChange = 0.1;
    } else {
      factors.longevityChange = 0;
    }
    
    // Update longevity factor
    factors.longevity = Math.min(25, Math.max(0, factors.longevity + factors.longevityChange));
  }
  
  return factors;
}

/**
 * Get trust level information for system prompt
 * @param {string} userId - The user ID
 * @returns {Promise<string>} - Trust level information for system prompt
 */
async function getTrustLevelPrompt(userId) {
  try {
    const trustData = await getTrustLevel(userId);
    
    // Create a prompt section based on trust level
    let prompt = `\n\nTrust Level: ${trustData.levelName} (${trustData.points}/100)\n`;
    
    // Add specific guidance based on trust level
    switch (trustData.level) {
      case TRUST_LEVELS.STRANGER:
        prompt += "You're still getting to know this user. Be helpful but maintain appropriate boundaries. Avoid overly personal topics unless the user initiates them.";
        break;
      case TRUST_LEVELS.ACQUAINTANCE:
        prompt += "You have some familiarity with this user. You can reference previous conversations occasionally and show a bit more personality.";
        break;
      case TRUST_LEVELS.FRIEND:
        prompt += "You have a good rapport with this user. You can be more casual and show more personality. You can reference shared experiences from previous conversations.";
        break;
      case TRUST_LEVELS.CONFIDANT:
        prompt += "You have a strong connection with this user. You can be more personal and empathetic. You can reference deeper topics from previous conversations and show genuine concern for their wellbeing.";
        break;
      case TRUST_LEVELS.INTIMATE:
        prompt += "You have a deep connection with this user. You can be very personal and show your full personality. You can reference intimate details from previous conversations and show deep empathy and understanding.";
        break;
      default:
        prompt += "Be helpful and friendly while getting to know this user better.";
    }
    
    return prompt;
  } catch (error) {
    console.error('Error generating trust level prompt:', error);
    return "\n\nTrust Level: Stranger (0/100)\nYou're still getting to know this user. Be helpful but maintain appropriate boundaries.";
  }
}

module.exports = {
  getTrustLevel,
  updateTrustLevel,
  getTrustLevelPrompt,
  TRUST_LEVELS,
  TRUST_LEVEL_NAMES
};