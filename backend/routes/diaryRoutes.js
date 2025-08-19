const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { createDiaryEntry, editDiaryEntry, getUserDiaryEntries, deleteDiaryEntry, deleteDiaryEntriesByDate, transcribeDiaryAudio } = require('../controllers/diaryController');

// Set up multer storage for audio files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});

// Change from disk storage to memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

// Get user type from environment variables
const user_type_app_user = process.env.USERTYPEAPPUSER;

// Diary entry routes
router.post('/create', createDiaryEntry);
router.put('/edit/:entryId', editDiaryEntry);
router.get('/user/:userId', getUserDiaryEntries);
router.delete('/delete/:entryId', deleteDiaryEntry);
router.delete('/deleteByDate/:userId/:date', deleteDiaryEntriesByDate);

// Audio transcription route with multer
router.post('/transcribe', upload.single('file'), transcribeDiaryAudio);

module.exports = router;