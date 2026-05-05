/**
 * Analytics Routes
 * Handles behavioral analytics and ML predictions
 * IMPORTANT: No video/audio analysis - only behavioral data
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const authenticateToken = require('../middleware/auth');
const { authorizeTeacher, authorizeStudent } = require('../middleware/rbac');
const Analytics = require('../models/Analytics');
const Meeting = require('../models/Meeting');

/**
 * @route   POST /api/analytics/submit
 * @desc    Submit behavioral data and get ML predictions (Student)
 * @access  Private (Student)
 */
router.post('/submit', authenticateToken, authorizeStudent, async (req, res) => {
  try {
    const { meetingId, behavioralData } = req.body;

    if (!meetingId || !behavioralData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Meeting ID and behavioral data required' 
      });
    }

    // Call ML service for predictions
    let predictions = {
      attention_status: 'unknown',
      confidence: 0,
      engagement_score: 0,
      cognitive_load: 'unknown',
      suggestion: 'Complete the session for personalized suggestions'
    };

    try {
      const mlResponse = await axios.post(`${process.env.ML_SERVICE_URL}/predict`, {
        behavioralData
      });
      predictions = mlResponse.data;
    } catch (mlError) {
      console.error('ML service error:', mlError.message);
      // Continue with default predictions if ML service fails
    }

    // Generate focus timeline
    const focusTimeline = generateFocusTimeline(behavioralData);

    // Save analytics
    const analytics = new Analytics({
      userId: req.user.userId,
      meetingId,
      userName: req.user.name || req.user.email,
      behavioralData,
      predictions,
      focusTimeline
    });

    await analytics.save();

    res.json({
      success: true,
      message: 'Analytics submitted successfully',
      analytics: {
        behavioralData,
        predictions,
        focusTimeline
      }
    });
  } catch (error) {
    console.error('Submit analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while submitting analytics' 
    });
  }
});

/**
 * @route   GET /api/analytics/my-stats/:meetingId
 * @desc    Get own analytics for a meeting (Student)
 * @access  Private (Student)
 */
router.get('/my-stats/:meetingId', authenticateToken, authorizeStudent, async (req, res) => {
  try {
    const analytics = await Analytics.findOne({
      userId: req.user.userId,
      meetingId: req.params.meetingId
    });

    if (!analytics) {
      return res.status(404).json({ 
        success: false, 
        message: 'No analytics found for this meeting' 
      });
    }

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Get my stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching analytics' 
    });
  }
});

/**
 * @route   GET /api/analytics/class/:meetingId
 * @desc    Get all student analytics for a meeting (Teacher only)
 * @access  Private (Teacher)
 */
router.get('/class/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const { password } = req.query;
    
    // Verify the meeting exists and check password if required
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check password if meeting is password-protected
    if (meeting.isPasswordProtected && meeting.password) {
      if (!password) {
        return res.status(403).json({
          success: false,
          message: 'This meeting is password protected. Please provide the password.',
          requiresPassword: true
        });
      }

      if (password !== meeting.password) {
        return res.status(403).json({
          success: false,
          message: 'Invalid password. Please try again.',
          requiresPassword: true
        });
      }
    }

    const analyticsData = await Analytics.find({ 
      meetingId: req.params.meetingId 
    });

    // Calculate class-level statistics
    const classStats = calculateClassStats(analyticsData);

    res.json({
      success: true,
      studentAnalytics: analyticsData,
      classStats
    });
  } catch (error) {
    console.error('Get class analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching class analytics' 
    });
  }
});

/**
 * Helper function to generate focus timeline
 * Simulates focus levels over time based on behavioral data
 */
function generateFocusTimeline(behavioralData) {
  const timeline = [];
  const duration = behavioralData.study_duration || 30;
  const intervals = Math.min(duration, 20); // Max 20 data points

  for (let i = 0; i < intervals; i++) {
    const timestamp = new Date(Date.now() - (duration - i) * 60000);
    
    // Calculate focus level based on behavioral data
    let focusLevel = 80; // Base focus
    
    // Reduce focus based on idle time and tab switches
    const idleRatio = behavioralData.idle_time / duration;
    const tabSwitchRatio = behavioralData.tab_switch_count / duration;
    
    focusLevel -= idleRatio * 30;
    focusLevel -= tabSwitchRatio * 20;
    focusLevel += Math.random() * 10 - 5; // Add some variance
    
    focusLevel = Math.max(0, Math.min(100, focusLevel)); // Clamp 0-100

    timeline.push({
      timestamp,
      focusLevel: Math.round(focusLevel)
    });
  }

  return timeline;
}

/**
 * Helper function to calculate class-level statistics
 */
function calculateClassStats(analyticsData) {
  if (analyticsData.length === 0) {
    return {
      totalStudents: 0,
      avgEngagement: 0,
      focusDropCount: 0,
      summary: 'No data available'
    };
  }

  const totalEngagement = analyticsData.reduce((sum, a) => 
    sum + (a.predictions.engagement_score || 0), 0
  );
  
  const avgEngagement = totalEngagement / analyticsData.length;
  
  // Count students with low engagement (< 50)
  const focusDropCount = analyticsData.filter(a => 
    (a.predictions.engagement_score || 0) < 50
  ).length;

  return {
    totalStudents: analyticsData.length,
    avgEngagement: Math.round(avgEngagement),
    focusDropCount,
    summary: focusDropCount > analyticsData.length / 2 
      ? 'Class needs attention - many students showing low engagement'
      : 'Class performance is good overall'
  };
}

module.exports = router;
