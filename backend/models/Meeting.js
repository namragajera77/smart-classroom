/**
 * Meeting Model
 * Stores meeting information created by teachers
 */

const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
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
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended'],
    default: 'scheduled'
  },
  scheduledFor: {
    type: Date,
    default: null
  },
  date: {
    type: String,
    default: null
  },
  startTime: {
    type: String,
    default: null
  },
  endTime: {
    type: String,
    default: null
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrenceType: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none'
  },
  recurrenceCount: {
    type: Number,
    default: 1,
    min: 1,
    max: 52
  },
  recurringSeriesId: {
    type: String,
    default: null
  },
  participants: {
    type: [String],
    default: []
  },
  reminderEnabled: {
    type: Boolean,
    default: false
  },
  reminderMinutesBefore: {
    type: Number,
    default: 30,
    min: 5,
    max: 1440
  },
  lastReminderSentAt: {
    type: Date,
    default: null
  },
  password: {
    type: String,
    default: null // null = no password protection
  },
  isPasswordProtected: {
    type: Boolean,
    default: false
  },
  waitingRoomEnabled: {
    type: Boolean,
    default: true
  },
  actualStartTime: {
    type: Date,
    default: null
  },
  actualEndTime: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Meeting', meetingSchema);
