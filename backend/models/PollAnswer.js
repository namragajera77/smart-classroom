/**
 * PollAnswer Model
 * Stores student responses to polls
 */

const mongoose = require('mongoose');

const pollAnswerSchema = new mongoose.Schema({
  pollId: {
    type: String,
    required: true
  },
  meetingId: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  selectedOptionId: {
    type: String,
    required: true
  },
  selectedOptionText: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Enforce one answer per user per poll at the database level.
pollAnswerSchema.index({ pollId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('PollAnswer', pollAnswerSchema);
