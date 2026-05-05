/**
 * Analytics Model
 * Stores behavioral analytics data for students
 * IMPORTANT: No video/audio analysis - only behavioral data
 */

const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  meetingId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  // Behavioral data (user activity tracking)
  behavioralData: {
    study_duration: { type: Number, default: 0 }, // in minutes
    idle_time: { type: Number, default: 0 },      // in minutes
    break_count: { type: Number, default: 0 },
    tab_switch_count: { type: Number, default: 0 }
  },
  // ML predictions
  predictions: {
    attention_status: { type: String, default: 'unknown' },
    confidence: { type: Number, default: 0 },
    engagement_score: { type: Number, default: 0 },
    cognitive_load: { type: String, default: 'unknown' },
    suggestion: { type: String, default: '' }
  },
  // Focus timeline for heatmap (array of focus levels over time)
  focusTimeline: [{
    timestamp: Date,
    focusLevel: Number // 0-100
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Analytics', analyticsSchema);
