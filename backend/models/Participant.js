/**
 * Participant Model
 * Tracks student participation in meetings
 */

const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
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
  userEmail: {
    type: String,
    default: null
  },
  joinTime: {
    type: Date,
    default: Date.now
  },
  leaveTime: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Waiting room feature
  status: {
    type: String,
    enum: ['waiting', 'admitted', 'rejected'],
    default: 'waiting'
  },
  admittedAt: {
    type: Date,
    default: null
  },
  admittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
});

module.exports = mongoose.model('Participant', participantSchema);
