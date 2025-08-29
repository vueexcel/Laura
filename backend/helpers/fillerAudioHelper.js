const fs = require('fs');
const path = require('path');

// Define the directory where filler audio files are stored
const FILLERS_DIR = path.join(__dirname, '..', 'cache', 'fillers');

// Categorize fillers by their general purpose/type
const FILLER_CATEGORIES = {
  thinking: ['thinking.mp3', 'hmm.mp3', 'umm.mp3'],
  processing: ['i_am_thinking.mp3', 'just_a_sec.mp3', 'lemme_check.mp3', 'hold_on.mp3'],
  emotional: ['smile.mp3', 'blush.mp3', 'sigh.mp3', 'relief.mp3'],
  reactive: ['gasp.mp3', 'ahhh.mp3', 'ugh.mp3', 'cough.mp3'],
  expressive: ['chuckling.mp3', 'long_laugh.mp3', 'clap.mp3'],
  transitional: ['clear_throt_one.mp3', 'clear_throt_two.mp3', 'clear_throt_three.mp3', 'throt_clear.mp3']
};

// Map of emotion tags to filler categories with weights
const EMOTION_TO_FILLER_MAP = {
  // Default balanced distribution
  'default': {
    thinking: 0.3,
    processing: 0.3,
    emotional: 0.2,
    reactive: 0.1,
    expressive: 0.05,
    transitional: 0.05
  },
  
  // Emotion-specific distributions
  'neutral': {
    thinking: 0.4,
    processing: 0.3,
    transitional: 0.2,
    emotional: 0.1
  },
  'happy': {
    expressive: 0.4,
    emotional: 0.3,
    thinking: 0.2,
    reactive: 0.1
  },
  'sad': {
    emotional: 0.4,
    thinking: 0.3,
    processing: 0.2,
    transitional: 0.1
  },
  'thinking': {
    thinking: 0.5,
    processing: 0.3,
    transitional: 0.2
  }
  // Other emotions will use the default distribution
};

// Add this at the top of the file after the EMOTION_TO_FILLER_MAP

// Pre-load filler audio files into memory for faster access
const PRELOADED_FILLERS = {};

function preloadFillerAudio() {
  // Get all unique filler files from the categories
  const allFillers = new Set();
  Object.values(FILLER_CATEGORIES).forEach(fillers => {
    fillers.forEach(filler => allFillers.add(filler));
  });
  
  // Load each file into memory
  allFillers.forEach(filler => {
    const fillerPath = path.join(FILLERS_DIR, filler);
    if (fs.existsSync(fillerPath)) {
      PRELOADED_FILLERS[filler] = fs.readFileSync(fillerPath);
      console.log(`Preloaded filler: ${filler}`);
    }
  });
  console.log(`Preloaded ${Object.keys(PRELOADED_FILLERS).length} filler audio files`);
}

// Call this function during initialization
preloadFillerAudio();

/**
 * Get a filler audio file based on emotion and response length
 * @param {string} emotion - The detected emotion
 * @param {number} responseLength - Length of the expected response
 * @returns {Object} - Object containing audio buffer and format
 */
// Update the getFillerAudio function to use preloaded files
async function getFillerAudio(emotion = 'neutral', responseLength = 0) {
  try {
    // Get the distribution for the emotion, or use default if not found
    const distribution = EMOTION_TO_FILLER_MAP[emotion] || EMOTION_TO_FILLER_MAP['default'];
    
    // Adjust distribution based on response length
    let adjustedDistribution = { ...distribution };
    if (responseLength > 200) {
      // Increase probability of processing fillers for longer responses
      adjustedDistribution.processing = (adjustedDistribution.processing || 0) + 0.3;
      // Normalize other probabilities
      const total = Object.values(adjustedDistribution).reduce((a, b) => a + b, 0);
      Object.keys(adjustedDistribution).forEach(key => {
        if (key !== 'processing') {
          adjustedDistribution[key] = (adjustedDistribution[key] || 0) * (0.7 / (total - adjustedDistribution.processing));
        }
      });
    }

    // Select a category based on weighted distribution
    const random = Math.random();
    let accumulator = 0;
    let selectedCategory = 'thinking'; // default fallback
    
    for (const [category, weight] of Object.entries(adjustedDistribution)) {
      accumulator += weight;
      if (random <= accumulator) {
        selectedCategory = category;
        break;
      }
    }

    // Get available fillers for the selected category
    const categoryFillers = FILLER_CATEGORIES[selectedCategory] || FILLER_CATEGORIES.thinking;
    const availableFillers = categoryFillers.filter(file => PRELOADED_FILLERS[file]);

    // Add some randomness to prevent repetition
    const lastUsedTime = getFillerAudio.lastUsed || {};
    const currentTime = Date.now();
    const availableNonRepeating = availableFillers.filter(file => {
      const timeSinceLastUse = currentTime - (lastUsedTime[file] || 0);
      return timeSinceLastUse > 5000; // Don't repeat within 5 seconds
    });

    // Select a filler, preferring non-repeating ones
    const selectedFiller = availableNonRepeating.length > 0 
      ? availableNonRepeating[Math.floor(Math.random() * availableNonRepeating.length)]
      : availableFillers[Math.floor(Math.random() * availableFillers.length)];

    // Update last used time
    getFillerAudio.lastUsed = getFillerAudio.lastUsed || {};
    getFillerAudio.lastUsed[selectedFiller] = currentTime;

    // Use preloaded buffer if available, otherwise read from disk
    const audioBuffer = PRELOADED_FILLERS[selectedFiller] || fs.readFileSync(path.join(FILLERS_DIR, selectedFiller));
    
    return {
      audioBuffer: audioBuffer,
      format: 'mp3',
      fillerName: selectedFiller,
      category: selectedCategory
    };
  } catch (error) {
    console.error('Error getting filler audio:', error);
    return null;
  }
}

/**
 * Check if filler audio files exist, and create placeholder files if they don't
 * This is useful for initial setup
 */
function ensureFillerFilesExist() {
  // Create the directory if it doesn't exist
  if (!fs.existsSync(FILLERS_DIR)) {
    fs.mkdirSync(FILLERS_DIR, { recursive: true });
    console.log(`Created fillers directory at ${FILLERS_DIR}`);
  }
  
  // List of default filler files to create if they don't exist
  const defaultFillers = [
    'ahhh.mp3',
    'blush.mp3',
    'chuckling.mp3',
    'clap.mp3',
    'clear_throt_one.mp3',
    'clear_throt_three.mp3',
    'clear_throt_two.mp3',
    'cough.mp3',
    'gasp.mp3',
    'hmm.mp3',
    'hold_on.mp3',
    'i_am_thinking.mp3',
    'just_a_sec.mp3',
    'lemme_check.mp3',
    'long_laugh.mp3',
    'relief.mp3',
    'sigh.mp3',
    'smile.mp3',
    'thinking.mp3',
    'throt_clear.mp3',
    'ugh.mp3',
    'umm.mp3',
    'yawn.mp3'
  ];
  
  // Create placeholder files with a message
  for (const filler of defaultFillers) {
    const fillerPath = path.join(FILLERS_DIR, filler);
    if (!fs.existsSync(fillerPath)) {
      // Create an empty file with a note
      fs.writeFileSync(fillerPath, 'Placeholder file. Replace with actual audio.');
      console.log(`Created placeholder for ${filler}`);
    }
  }
  
  console.log('Filler audio files checked/created.');
}

module.exports = {
  getFillerAudio,
  ensureFillerFilesExist
};