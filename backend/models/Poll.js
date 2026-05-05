/**
 * Poll Model
 * Stores poll/quiz questions created by teachers during meetings
 */

const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  pollId: {
    type: String,
    required: true,
    unique: true
  },
  meetingId: {
    type: String,
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacherName: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  options: [{
    optionId: String,
    text: String
  }],
  correctAnswer: {
    type: String,
    default: null // For quiz mode
  },
  isActive: {
    type: Boolean,
    default: true
  },
  showResultsToStudents: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Poll', pollSchema);
