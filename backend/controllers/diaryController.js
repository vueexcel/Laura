const asyncHandler = require('express-async-handler');
const admin = require('firebase-admin');
const { returnResponse, verifyrequiredparams } = require('../middleware/common');

// Get Firestore instance
const db = admin.firestore();

/**
 * @desc    Create a new diary entry
 * @route   POST /api/diary/create
 * @access  Private
 */
const createDiaryEntry = asyncHandler(async (req, res) => {
  try {
    // Verify required parameters
    await verifyrequiredparams(400, req.body, ['date', 'title', 'body'], res); // userId is not included here

    const userId = req.user ? req.user.id : "test_user_id";
    const { date, title, body } = req.body;

    // Create timestamps
    const now = admin.firestore.Timestamp.now();

    // Create the diary entry document
    const diaryEntryData = {
      userId,
      date,
      title,
      body,
      createdAt: now,
      updatedAt: now
    };

    // Add the document to the diaryEntries collection
    const docRef = await db.collection('diaryEntries').add(diaryEntryData);

    // Return the created entry with its ID
    return returnResponse(201, 'Diary entry created successfully', {
      entryId: docRef.id,
      ...diaryEntryData,
      createdAt: now.toDate(),
      updatedAt: now.toDate()
    }, res);
  } catch (error) {
    console.error('Error creating diary entry:', error);
    throw new Error(error.message || 'Failed to create diary entry');
  }
});

/**
 * @desc    Edit an existing diary entry
 * @route   PUT /api/diary/edit/:entryId
 * @access  Private
 */
const editDiaryEntry = asyncHandler(async (req, res) => {
  try {
    const userId = req.user ? req.user.id : "test_user_id";
    const { entryId } = req.params;
    const { title, body } = req.body;
    
    // Verify that at least one field to update is provided
    if (!title && !body) {
      return returnResponse(400, 'At least one field (title or body) must be provided for update', null, res);
    }
    
    // Get the diary entry document
    const diaryEntryRef = db.collection('diaryEntries').doc(entryId);
    const diaryEntryDoc = await diaryEntryRef.get();
    
    // Check if the entry exists
    if (!diaryEntryDoc.exists) {
      return returnResponse(404, 'Diary entry not found', null, res);
    }

    // Verify the user ID
    if (diaryEntryDoc.data().userId !== userId) {
        return returnResponse(403, 'Unauthorized: You are not allowed to edit this diary entry', null, res);
    }
    
    // Prepare update data
    const updateData = {
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    if (title) updateData.title = title;
    if (body) updateData.body = body;
    
    // Update the document
    await diaryEntryRef.update(updateData);
    
    // Get the updated document
    const updatedDoc = await diaryEntryRef.get();
    const updatedData = updatedDoc.data();
    
    // Return the updated entry
    return returnResponse(200, 'Diary entry updated successfully', {
      entryId,
      ...updatedData,
      createdAt: updatedData.createdAt.toDate(),
      updatedAt: updatedData.updatedAt.toDate()
    }, res);
  } catch (error) {
    console.error('Error updating diary entry:', error);
    throw new Error(error.message || 'Failed to update diary entry');
  }
});

/**
 * @desc    Get all diary entries for a user with optional date filtering
 * @route   GET /api/diary/user/:userId
 * @access  Private
 */
const getUserDiaryEntries = asyncHandler(async (req, res) => {
  try {
    const userId = req.user ? req.user.id : "test_user_id";
    const { startDate, endDate } = req.query;

    // Verify that the requested userId matches the user's ID
    if (req.params.userId !== userId) {
        return returnResponse(403, 'Unauthorized: You are not allowed to access these diary entries', null, res);
    }
    
    // Create a query for the user's diary entries
    let query = db.collection('diaryEntries').where('userId', '==', userId);
    
    // Add date range filtering if provided
    if (startDate && endDate) {
      query = query.where('date', '>=', startDate).where('date', '<=', endDate);
    } else if (startDate) {
      query = query.where('date', '>=', startDate);
    } else if (endDate) {
      query = query.where('date', '<=', endDate);
    }
    
    // Execute the query
    const querySnapshot = await query.get();
    
    // Process the results
    const entries = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      entries.push({
        entryId: doc.id,
        userId: data.userId,
        date: data.date,
        title: data.title,
        body: data.body,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      });
    });
    
    // Sort entries by date (newest first)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return returnResponse(200, 'Diary entries retrieved successfully', entries, res);
  } catch (error) {
    console.error('Error fetching diary entries:', error);
    throw new Error(error.message || 'Failed to fetch diary entries');
  }
});

module.exports = {
  createDiaryEntry,
  editDiaryEntry,
  getUserDiaryEntries
};