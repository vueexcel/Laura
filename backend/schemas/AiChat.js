const mongoose = require('mongoose');
const ChatEntrySchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  response: {
    type: mongoose.Schema.Types.Mixed, // Can be a string or an object
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


const AiChat = mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    chat:[ChatEntrySchema]
}, {
    timestamps: true,
})

module.exports = mongoose.model("aichats", AiChat)