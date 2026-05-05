/**
 * Poll Routes
 * Handles poll creation, submission, and result retrieval
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { authorizeTeacher, authorizeStudent, authorizeBoth } = require('../middleware/rbac');
const Poll = require('../models/Poll');
const PollAnswer = require('../models/PollAnswer');

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

/**
 * @route   POST /api/polls/create
 * @desc    Create new poll (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/create', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const { meetingId, title, question, options, showResultsToStudents } = req.body;

    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedQuestion = typeof question === 'string' ? question.trim() : '';
    const normalizedOptions = Array.isArray(options)
      ? options
          .map((opt) => (typeof opt === 'string' ? opt.trim() : ''))
          .filter((opt) => opt.length > 0)
      : [];

    if (!meetingId || !normalizedTitle || !normalizedQuestion || normalizedOptions.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Meeting ID, title, question, and at least 2 options are required'
      });
    }

    // Generate unique poll ID
    const pollId = 'POLL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Format options with IDs
    const formattedOptions = normalizedOptions.map((text, idx) => ({
      optionId: `opt-${idx}`,
      text
    }));

    const poll = new Poll({
      pollId,
      meetingId,
      teacherId: req.user.userId,
      teacherName: req.user.email,
      title: normalizedTitle,
      question: normalizedQuestion,
      options: formattedOptions,
      showResultsToStudents: normalizeBoolean(showResultsToStudents, false)
    });

    await poll.save();

    res.status(201).json({
      success: true,
      message: 'Poll created successfully',
      poll: {
        pollId: poll.pollId,
        title: poll.title,
        question: poll.question,
        options: poll.options,
        isActive: poll.isActive,
        showResultsToStudents: poll.showResultsToStudents
      }
    });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating poll'
    });
  }
});

/**
 * @route   POST /api/polls/submit-answer
 * @desc    Submit poll answer (Student)
 * @access  Private (Student)
 */
router.post('/submit-answer', authenticateToken, authorizeStudent, async (req, res) => {
  try {
    const { pollId, meetingId, selectedOptionId } = req.body;

    if (!pollId || !selectedOptionId) {
      return res.status(400).json({
        success: false,
        message: 'Poll ID and option ID are required'
      });
    }

    // Check if poll exists and is active
    const poll = await Poll.findOne({ pollId, isActive: true });
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found or is closed'
      });
    }

    if (meetingId && poll.meetingId !== meetingId) {
      return res.status(400).json({
        success: false,
        message: 'Poll does not belong to this meeting'
      });
    }

    const selectedOption = poll.options.find((opt) => opt.optionId === selectedOptionId);
    if (!selectedOption) {
      return res.status(400).json({
        success: false,
        message: 'Selected option is invalid'
      });
    }

    // Check if student already answered
    const existingAnswer = await PollAnswer.findOne({
      pollId,
      userId: req.user.userId
    });

    if (existingAnswer) {
      return res.status(400).json({
        success: false,
        message: 'You have already answered this poll'
      });
    }

    // Save poll answer
    const pollAnswer = new PollAnswer({
      pollId,
      meetingId: poll.meetingId,
      userId: req.user.userId,
      userName: req.user.email,
      selectedOptionId,
      selectedOptionText: selectedOption.text
    });

    await pollAnswer.save();

    res.json({
      success: true,
      message: 'Poll answer submitted successfully',
      answer: {
        pollId,
        selectedOptionId,
        selectedOptionText: selectedOption.text
      }
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already answered this poll'
      });
    }

    console.error('Submit answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting answer'
    });
  }
});

/**
 * @route   GET /api/polls/:pollId/results
 * @desc    Get poll results (Teacher or if results visible to students)
 * @access  Private (Teacher or Student if results are visible)
 */
router.get('/:pollId/results', authenticateToken, authorizeBoth, async (req, res) => {
  try {
    const poll = await Poll.findOne({ pollId: req.params.pollId });

    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    // Check if student can view results
    if (req.user.role === 'student' && !poll.showResultsToStudents) {
      return res.status(403).json({
        success: false,
        message: 'Results are not yet available'
      });
    }

    // Get all answers for this poll
    const answers = await PollAnswer.find({ pollId: req.params.pollId });

    // Calculate results
    const results = {};
    poll.options.forEach(opt => {
      results[opt.optionId] = {
        text: opt.text,
        count: 0,
        percentage: 0
      };
    });

    let totalResponses = 0;
    answers.forEach(answer => {
      if (results[answer.selectedOptionId]) {
        results[answer.selectedOptionId].count++;
        totalResponses++;
      }
    });

    // Calculate percentages
    if (totalResponses > 0) {
      Object.keys(results).forEach(optId => {
        results[optId].percentage = Math.round((results[optId].count / totalResponses) * 100);
      });
    }

    res.json({
      success: true,
      results: {
        pollId: poll.pollId,
        title: poll.title,
        question: poll.question,
        totalResponses,
        options: results,
        isActive: poll.isActive,
        showResultsToStudents: poll.showResultsToStudents,
        createdAt: poll.createdAt,
        closedAt: poll.closedAt
      }
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching results'
    });
  }
});

/**
 * @route   POST /api/polls/:pollId/close
 * @desc    Close a poll (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/:pollId/close', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const { showResults } = req.body;

    const poll = await Poll.findOne({ pollId: req.params.pollId });

    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    // Update poll
    if (!poll.isActive) {
      return res.json({
        success: true,
        message: 'Poll is already closed',
        poll
      });
    }

    poll.isActive = false;
    poll.closedAt = new Date();
    if (showResults !== undefined) {
      poll.showResultsToStudents = normalizeBoolean(showResults, poll.showResultsToStudents);
    }
    await poll.save();

    res.json({
      success: true,
      message: 'Poll closed successfully',
      poll
    });
  } catch (error) {
    console.error('Close poll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while closing poll'
    });
  }
});

/**
 * @route   PATCH /api/polls/:pollId/visibility
 * @desc    Toggle whether students can view poll results (Teacher only)
 * @access  Private (Teacher)
 */
router.patch('/:pollId/visibility', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const { showResults } = req.body;

    if (typeof showResults === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'showResults is required'
      });
    }

    const poll = await Poll.findOne({ pollId: req.params.pollId });

    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    poll.showResultsToStudents = normalizeBoolean(showResults, poll.showResultsToStudents);
    await poll.save();

    res.json({
      success: true,
      message: `Results visibility updated to ${poll.showResultsToStudents ? 'visible' : 'hidden'}`,
      poll: {
        pollId: poll.pollId,
        showResultsToStudents: poll.showResultsToStudents,
        isActive: poll.isActive,
        closedAt: poll.closedAt
      }
    });
  } catch (error) {
    console.error('Update poll visibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating visibility'
    });
  }
});

/**
 * @route   GET /api/polls/meeting/:meetingId
 * @desc    Get all polls for a meeting
 * @access  Private (Both)
 */
router.get('/meeting/:meetingId', authenticateToken, authorizeBoth, async (req, res) => {
  try {
    const polls = await Poll.find({ meetingId: req.params.meetingId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      polls
    });
  } catch (error) {
    console.error('Get meeting polls error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching polls'
    });
  }
});

/**
 * @route   GET /api/polls/:pollId/export
 * @desc    Export poll results as CSV
 * @access  Private (Teacher only)
 */
router.get('/:pollId/export', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const { stringify } = require('csv-stringify/sync');

    const poll = await Poll.findOne({ pollId: req.params.pollId });
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    const answers = await PollAnswer.find({ pollId: req.params.pollId });

    // Build CSV data
    const rows = [
      ['POLL RESULTS EXPORT'],
      ['Poll Title', poll.title],
      ['Question', poll.question],
      ['Teacher', poll.teacherName],
      ['Created', new Date(poll.createdAt).toLocaleString()],
      [],
      ['Student Name', 'Selected Option', 'Response Time']
    ];

    answers.forEach(answer => {
      rows.push([
        answer.userName,
        answer.selectedOptionText,
        new Date(answer.timestamp).toLocaleString()
      ]);
    });

    rows.push([]);
    rows.push(['SUMMARY']);
    
    const summary = {};
    poll.options.forEach(opt => {
      const count = answers.filter(a => a.selectedOptionId === opt.optionId).length;
      summary[opt.text] = count;
    });

    Object.entries(summary).forEach(([option, count]) => {
      const percentage = answers.length > 0 ? Math.round((count / answers.length) * 100) : 0;
      rows.push([option, count, `${percentage}%`]);
    });

    const csv = stringify(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="poll-results-${poll.pollId}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export poll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting poll'
    });
  }
});

module.exports = router;
