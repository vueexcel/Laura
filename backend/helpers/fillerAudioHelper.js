const fs = require('fs');
const path = require('path');

// Define the directory where filler audio files are stored
const FILLERS_DIR = path.join(__dirname, '..', 'cache', 'fillers');

// Map of emotion tags to appropriate filler sounds
const EMOTION_TO_FILLER_MAP = {
  // Default fillers
  'default': ['thinking.mp3', 'umm.mp3', 'hmm.mp3', 'i_am_thinking.mp3'],
  
  // Emotion-specific fillers
  'neutral': ['thinking.mp3', 'umm.mp3', 'i_am_thinking.mp3'],
  'happy': ['hmm.mp3', 'umm.mp3', 'smile.mp3', 'chuckling.mp3'],
  'sad': ['hmm.mp3', 'umm.mp3', 'sigh.mp3'],
  'angry': ['hmm.mp3', 'clear_throt_one.mp3', 'clear_throt_two.mp3', 'clear_throt_three.mp3'],
  'surprised': ['hmm.mp3', 'umm.mp3', 'gasp.mp3'],
  'fearful': ['umm.mp3', 'ahhh.mp3'],
  'disgusted': ['hmm.mp3', 'ugh.mp3'],
  'thinking': ['thinking.mp3', 'hmm.mp3', 'umm.mp3', 'i_am_thinking.mp3'],
  'mellow': ['hmm.mp3', 'sigh.mp3'],
  'anxious': ['umm.mp3', 'cough.mp3'],
  'overlyexcited': ['hmm.mp3', 'clap.mp3', 'gasp.mp3'],
  'Playful/cheeky': ['hmm.mp3', 'chuckling.mp3', 'smile.mp3'],
  'serious': ['hmm.mp3', 'thinking.mp3', 'throt_clear.mp3'],
  'Flirty': ['hmm.mp3', 'blush.mp3', 'smile.mp3'],
  'melancholic': ['sigh.mp3', 'umm.mp3'],
  'confident': ['throt_clear.mp3', 'hmm.mp3'],
  'wistful': ['sigh.mp3', 'hmm.mp3'],
  'gentle': ['hmm.mp3', 'smile.mp3'],
  'affectionate': ['smile.mp3', 'blush.mp3'],
  'chaotic': ['ahhh.mp3', 'gasp.mp3'],
  'tired': ['yawn.mp3', 'sigh.mp3'],
  'relieved': ['relief.mp3', 'sigh.mp3'],
  'laughing': ['chuckling.mp3', 'long_laugh.mp3'],
  
  // Add more mappings as needed
};

// Add this at the top of the file after the EMOTION_TO_FILLER_MAP

// Pre-load filler audio files into memory for faster access
const PRELOADED_FILLERS = {};

function preloadFillerAudio() {
  // Get all unique filler files from the emotion map
  const allFillers = new Set();
  Object.values(EMOTION_TO_FILLER_MAP).forEach(fillers => {
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
    // Determine which filler to use based on emotion and response length
    let fillerOptions = EMOTION_TO_FILLER_MAP[emotion] || EMOTION_TO_FILLER_MAP['default'];
    
    // For longer responses, prefer "let me check" or "just a sec" type fillers
    if (responseLength > 200) {
      // Choose from longer thinking fillers
      const longThinkingFillers = ['lemme_check.mp3', 'just_a_sec.mp3', 'i_am_thinking.mp3', 'hold_on.mp3'];
      
      // Filter to only include files that are preloaded
      const availableFillers = longThinkingFillers.filter(file => PRELOADED_FILLERS[file]);
      
      if (availableFillers.length > 0) {
        fillerOptions = availableFillers;
      }
    }
    
    // Randomly select a filler from the options
    const selectedFiller = fillerOptions[Math.floor(Math.random() * fillerOptions.length)];
    
    // Use preloaded buffer if available, otherwise read from disk
    const audioBuffer = PRELOADED_FILLERS[selectedFiller] || fs.readFileSync(path.join(FILLERS_DIR, selectedFiller));
    
    return {
      audioBuffer: audioBuffer,
      format: 'mp3',
      fillerName: selectedFiller
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