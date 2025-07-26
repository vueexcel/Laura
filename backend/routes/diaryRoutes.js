const express = require('express');
const router = express.Router();
const { createDiaryEntry, editDiaryEntry, getUserDiaryEntries, deleteDiaryEntry, deleteDiaryEntriesByDate } = require('../controllers/diaryController');
// const { protect } = require('../middleware/authMiddleware'); // Commenting out the protect middleware

// Get user type from environment variables
const user_type_app_user = process.env.USERTYPEAPPUSER;

// Diary entry routes
router.post('/create', /*protect([user_type_app_user]),*/ createDiaryEntry); // Commenting out the protect middleware
router.put('/edit/:entryId', /*protect([user_type_app_user]),*/ editDiaryEntry); // Commenting out the protect middleware
router.get('/user/:userId', /*protect([user_type_app_user]),*/ getUserDiaryEntries); // Commenting out the protect middleware
router.delete('/delete/:entryId', deleteDiaryEntry);
router.delete('/deleteByDate/:userId/:date', deleteDiaryEntriesByDate);

module.exports = router;