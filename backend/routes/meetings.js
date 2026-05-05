/**
 * Meeting Routes
 * Handles meeting creation, management, waiting room, attendance, and scheduling
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { authorizeTeacher, authorizeStudent, authorizeBoth } = require('../middleware/rbac');
const Meeting = require('../models/Meeting');
const Participant = require('../models/Participant');
const User = require('../models/User');

const CHAT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(CHAT_UPLOAD_DIR)) {
  fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
}

const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_STUDENTS_PER_MEETING = 50;
const ALLOWED_CHAT_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.txt', '.rtf',
  '.ppt', '.pptx', '.xls', '.xlsx'
]);

const chatFileUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, CHAT_UPLOAD_DIR),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeBase = path
        .basename(file.originalname || 'file', ext)
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}${ext}`);
    }
  }),
  limits: { fileSize: MAX_CHAT_FILE_SIZE },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_CHAT_EXTENSIONS.has(ext)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  }
});

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addRecurrence(baseDate, recurrenceType, step) {
  const nextDate = new Date(baseDate);
  if (recurrenceType === 'daily') nextDate.setDate(nextDate.getDate() + step);
  if (recurrenceType === 'weekly') nextDate.setDate(nextDate.getDate() + (7 * step));
  if (recurrenceType === 'monthly') nextDate.setMonth(nextDate.getMonth() + step);
  return nextDate;
}

function isValidTimeString(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ''));
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDateTime(dateStr, timeStr, timezoneOffsetMinutes) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const [hour, minute] = String(timeStr).split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;

  if (Number.isInteger(timezoneOffsetMinutes)) {
    const utcMs = Date.UTC(year, month - 1, day, hour, minute) + (timezoneOffsetMinutes * 60 * 1000);
    return new Date(utcMs);
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function generateRecurringDateKeys(baseDateKey, recurrenceType, windowDays = 30) {
  const [year, month, day] = String(baseDateKey).split('-').map(Number);
  const base = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
  const end = new Date(base);
  end.setDate(end.getDate() + windowDays);

  const keys = [];
  let cursor = new Date(base);

  while (cursor <= end) {
    keys.push(toDateKey(cursor));

    if (recurrenceType === 'daily') cursor.setDate(cursor.getDate() + 1);
    else if (recurrenceType === 'weekly') cursor.setDate(cursor.getDate() + 7);
    else if (recurrenceType === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
    else break;
  }

  return keys;
}

async function ensureTeacherMeeting(req, res) {
  const meeting = await Meeting.findOne({
    meetingId: req.params.meetingId,
    teacherId: req.user.userId
  });

  if (!meeting) {
    res.status(404).json({
      success: false,
      message: 'Meeting not found or access denied'
    });
    return null;
  }

  return meeting;
}

async function ensureTeacherMeetingById(meetingId, userId) {
  return Meeting.findOne({ meetingId, teacherId: userId });
}

async function countActiveStudentParticipants(meeting) {
  return Participant.countDocuments({
    meetingId: meeting.meetingId,
    isActive: true,
    status: 'admitted',
    userId: { $ne: meeting.teacherId }
  });
}

function emitWaitingRoomEvent(req, eventName, payload, targets = {}) {
  const io = req.app.get('io');
  if (!io) return;

  const { userId, teacherId, meetingId } = targets;
  let emitted = false;

  if (userId) {
    io.to(`user:${userId}`).emit(eventName, payload);
    emitted = true;
  }
  if (teacherId) {
    io.to(`user:${teacherId}`).emit(eventName, payload);
    emitted = true;
  }
  if (meetingId) {
    io.to(meetingId).emit(eventName, payload);
    emitted = true;
  }

  if (!emitted) {
    io.emit(eventName, payload);
  }
}

/**
 * @route   POST /api/meetings/chat-upload/:meetingId
 * @desc    Upload a chat file (Both)
 * @access  Private (Both)
 */
router.post('/chat-upload/:meetingId', authenticateToken, authorizeBoth, (req, res) => {
  chatFileUpload.single('file')(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        const message = uploadError.code === 'LIMIT_FILE_SIZE'
          ? 'File too large. Maximum size is 10 MB.'
          : uploadError.message || 'File upload failed';
        return res.status(400).json({ success: false, message });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
      if (!meeting) {
        return res.status(404).json({ success: false, message: 'Meeting not found' });
      }

      const ext = path.extname(req.file.originalname || '').toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/chat/${req.file.filename}`;

      return res.json({
        success: true,
        file: {
          name: req.file.originalname,
          size: req.file.size,
          url: fileUrl,
          isImage,
          extension: ext
        }
      });
    } catch (error) {
      console.error('Chat upload error:', error);
      return res.status(500).json({ success: false, message: 'Server error while uploading file' });
    }
  });
});

/**
 * @route   POST /api/meetings/create
 * @desc    Create new meeting (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/create', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const {
      title,
      isPasswordProtected,
      password,
      waitingRoomEnabled = true,
      startNow = false,
      scheduledFor,
      recurrenceType = 'none',
      recurrenceCount = 1,
      reminderEnabled = false,
      reminderMinutesBefore = 30
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Meeting title is required'
      });
    }

    const normalizedRecurrenceType = 'none';
    const normalizedStartNow = Boolean(startNow);

    const normalizedReminderMinutes = Math.max(
      5,
      Math.min(parseInt(reminderMinutesBefore, 10) || 30, 1440)
    );

    const parsedScheduledFor = toDateOrNull(scheduledFor);
    if (scheduledFor && !parsedScheduledFor) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduled date/time'
      });
    }

    if (normalizedStartNow && parsedScheduledFor) {
      return res.status(400).json({
        success: false,
        message: 'Immediate meeting should not include scheduled date/time'
      });
    }

    let meetingPassword = null;
    if (isPasswordProtected) {
      meetingPassword = password || Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    const recurringSeriesId = null;

    const meetingsToCreate = [];
    const totalToCreate = 1;

    for (let i = 0; i < totalToCreate; i++) {
      const meetingId = `MTG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const occurrenceScheduledFor = normalizedStartNow
        ? new Date()
        : (parsedScheduledFor
        ? addRecurrence(parsedScheduledFor, normalizedRecurrenceType, i)
        : null);

      meetingsToCreate.push({
        meetingId,
        title,
        teacherId: req.user.userId,
        teacherName: req.user.email,
        status: normalizedStartNow ? 'active' : 'scheduled',
        actualStartTime: normalizedStartNow ? new Date() : null,
        password: meetingPassword,
        isPasswordProtected: !!meetingPassword,
        waitingRoomEnabled: Boolean(waitingRoomEnabled),
        scheduledFor: occurrenceScheduledFor,
        recurrenceType: 'none',
        recurrenceCount: 1,
        recurringSeriesId,
        reminderEnabled: Boolean(reminderEnabled),
        reminderMinutesBefore: normalizedReminderMinutes
      });
    }

    const createdMeetings = await Meeting.insertMany(meetingsToCreate);
    const firstMeeting = createdMeetings[0];

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      createdCount: createdMeetings.length,
      meeting: {
        id: firstMeeting._id,
        meetingId: firstMeeting.meetingId,
        title: firstMeeting.title,
        status: firstMeeting.status,
        scheduledFor: firstMeeting.scheduledFor,
        recurrenceType: firstMeeting.recurrenceType,
        recurrenceCount: firstMeeting.recurrenceCount,
        recurringSeriesId: firstMeeting.recurringSeriesId,
        reminderEnabled: firstMeeting.reminderEnabled,
        reminderMinutesBefore: firstMeeting.reminderMinutesBefore,
        isPasswordProtected: firstMeeting.isPasswordProtected,
        waitingRoomEnabled: firstMeeting.waitingRoomEnabled,
        password: firstMeeting.password,
        createdAt: firstMeeting.createdAt
      }
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating meeting'
    });
  }
});

/**
 * @route   POST /api/meetings/schedule
 * @desc    Schedule meeting with recurrence support (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/schedule', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const {
      title,
      description = '',
      date,
      startTime,
      endTime,
      isRecurring = false,
      recurrenceType = 'daily',
      waitingRoomEnabled = true,
      isPasswordProtected = false,
      password,
      reminderEnabled = true,
      reminderMinutesBefore = 30,
      timezoneOffsetMinutes
    } = req.body;

    const trimmedTitle = String(title || '').trim();
    const trimmedDescription = String(description || '').trim();
    const dateKey = String(date || '').trim();
    const normalizedRecurring = false;
    const normalizedRecurrence = 'none';

    if (!trimmedTitle || !dateKey || !isValidTimeString(startTime) || !isValidTimeString(endTime)) {
      return res.status(400).json({
        success: false,
        message: 'title, date, startTime and endTime are required (HH:MM format)'
      });
    }

    if (Boolean(isRecurring)) {
      return res.status(400).json({
        success: false,
        message: 'Repeat meetings are disabled'
      });
    }

    const firstStart = buildDateTime(dateKey, startTime, timezoneOffsetMinutes);
    const firstEnd = buildDateTime(dateKey, endTime, timezoneOffsetMinutes);

    if (!firstStart || !firstEnd) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date/time values'
      });
    }

    if (firstEnd <= firstStart) {
      return res.status(400).json({
        success: false,
        message: 'endTime must be greater than startTime'
      });
    }

    if (firstStart < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot schedule meetings in the past'
      });
    }

    const occurrenceDates = [dateKey];

    const uniqueDates = [...new Set(occurrenceDates)];
    const recurringSeriesId = null;

    let meetingPassword = null;
    if (isPasswordProtected) {
      meetingPassword = password || Math.random().toString(36).slice(2, 10).toUpperCase();
    }

    const docs = [];
    for (const occurrenceDate of uniqueDates) {
      const scheduledAt = buildDateTime(occurrenceDate, startTime, timezoneOffsetMinutes);
      if (!scheduledAt || scheduledAt < new Date()) continue;

      // Duplicate prevention for same teacher + slot.
      const duplicate = await Meeting.findOne({
        teacherId: req.user.userId,
        date: occurrenceDate,
        startTime,
        endTime,
        title: trimmedTitle,
        status: { $ne: 'ended' }
      });
      if (duplicate) continue;

      docs.push({
        meetingId: `MTG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        title: trimmedTitle,
        description: trimmedDescription,
        teacherId: req.user.userId,
        teacherName: req.user.name || req.user.email,
        scheduledFor: scheduledAt,
        date: occurrenceDate,
        startTime,
        endTime,
        isRecurring: false,
        recurrenceType: 'none',
        recurrenceCount: 1,
        recurringSeriesId,
        reminderEnabled: Boolean(reminderEnabled),
        reminderMinutesBefore: Math.max(5, Math.min(Number(reminderMinutesBefore) || 30, 1440)),
        waitingRoomEnabled: Boolean(waitingRoomEnabled),
        isPasswordProtected: Boolean(meetingPassword),
        password: meetingPassword,
        participants: []
      });
    }

    if (!docs.length) {
      return res.status(409).json({
        success: false,
        message: 'No meetings were created. They may be duplicates or outside the valid schedule window.'
      });
    }

    const created = await Meeting.insertMany(docs);
    const first = created[0];

    return res.status(201).json({
      success: true,
      message: created.length > 1 ? `Scheduled ${created.length} meetings` : 'Meeting scheduled successfully',
      createdCount: created.length,
      meeting: {
        _id: first._id,
        title: first.title,
        description: first.description,
        teacherId: first.teacherId,
        meetingId: first.meetingId,
        date: first.date,
        startTime: first.startTime,
        endTime: first.endTime,
        scheduledFor: first.scheduledFor,
        isRecurring: first.isRecurring,
        recurrenceType: first.recurrenceType,
        participants: first.participants,
        createdAt: first.createdAt
      }
    });
  } catch (error) {
    console.error('Schedule meeting error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while scheduling meeting'
    });
  }
});

/**
 * @route   GET /api/meetings/my-meetings
 * @desc    Get all meetings created by teacher
 * @access  Private (Teacher)
 */
router.get('/my-meetings', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meetings = await Meeting.find({ teacherId: req.user.userId })
      .sort({ scheduledFor: 1, createdAt: -1 });

    res.json({
      success: true,
      meetings
    });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching meetings'
    });
  }
});

/**
 * @route   GET /api/meetings/upcoming
 * @desc    Get upcoming meetings for calendar view
 * @access  Private (Both)
 */
router.get('/upcoming', authenticateToken, authorizeBoth, async (req, res) => {
  try {
    const now = new Date();
    const query = {
      status: { $in: ['scheduled', 'active'] },
      $or: [
        { scheduledFor: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
        { status: 'active' }
      ]
    };

    if (req.user.role === 'teacher') {
      query.teacherId = req.user.userId;
    } else {
      const student = await User.findById(req.user.userId).select('assignedTeacherId assignedTeacherIds');
      const teacherIds = Array.isArray(student?.assignedTeacherIds) && student.assignedTeacherIds.length
        ? student.assignedTeacherIds
        : (student?.assignedTeacherId ? [student.assignedTeacherId] : []);

      if (!teacherIds.length) {
        return res.json({ success: true, meetings: [] });
      }
      query.teacherId = { $in: teacherIds };
    }

    const meetings = await Meeting.find(query)
      .sort({ scheduledFor: 1, createdAt: 1 })
      .limit(200);

    res.json({
      success: true,
      meetings
    });
  } catch (error) {
    console.error('Get upcoming meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming meetings'
    });
  }
});

/**
 * @route   GET /api/meetings/calendar
 * @desc    Get upcoming meetings grouped by date
 * @access  Private (Both)
 */
router.get('/calendar', authenticateToken, authorizeBoth, async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const query = {
      status: { $in: ['scheduled', 'active'] },
      $or: [
        { scheduledFor: { $gte: startOfToday } },
        { status: 'active' }
      ]
    };

    if (req.user.role === 'teacher') {
      query.teacherId = req.user.userId;
    } else {
      const student = await User.findById(req.user.userId).select('assignedTeacherId assignedTeacherIds');
      const teacherIds = Array.isArray(student?.assignedTeacherIds) && student.assignedTeacherIds.length
        ? student.assignedTeacherIds
        : (student?.assignedTeacherId ? [student.assignedTeacherId] : []);

      if (!teacherIds.length) {
        return res.json({ success: true, calendar: {} });
      }
      query.teacherId = { $in: teacherIds };
    }

    const meetings = await Meeting.find(query).sort({ scheduledFor: 1, createdAt: 1 });

    const grouped = {};
    meetings.forEach((meeting) => {
      const key = meeting.date
        || (meeting.scheduledFor ? new Date(meeting.scheduledFor).toISOString().split('T')[0] : null)
        || 'unscheduled';

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        _id: meeting._id,
        title: meeting.title,
        description: meeting.description,
        meetingId: meeting.meetingId,
        date: meeting.date,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        scheduledFor: meeting.scheduledFor,
        status: meeting.status,
        isRecurring: meeting.isRecurring,
        recurrenceType: meeting.recurrenceType,
        teacherName: meeting.teacherName
      });
    });

    return res.json({
      success: true,
      calendar: grouped
    });
  } catch (error) {
    console.error('Get calendar meetings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching calendar meetings'
    });
  }
});

/**
 * @route   DELETE /api/meetings/meeting/:id
 * @desc    Delete/cancel meeting (Teacher only)
 * @access  Private (Teacher)
 */
router.delete('/meeting/:id', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const deleted = await Meeting.findOneAndDelete({
      _id: req.params.id,
      teacherId: req.user.userId
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or access denied'
      });
    }

    await Participant.deleteMany({ meetingId: deleted.meetingId });

    return res.json({
      success: true,
      message: 'Meeting deleted successfully',
      meetingId: deleted.meetingId
    });
  } catch (error) {
    console.error('Delete meeting error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting meeting'
    });
  }
});

/**
 * @route   GET /api/meetings/due-reminders
 * @desc    Get meetings where reminder should fire now
 * @access  Private (Both)
 */
router.get('/due-reminders', authenticateToken, authorizeBoth, async (req, res) => {
  try {
    const now = new Date();
    const query = {
      status: 'scheduled',
      reminderEnabled: true,
      scheduledFor: { $ne: null }
    };

    if (req.user.role === 'teacher') {
      query.teacherId = req.user.userId;
    }

    const meetings = await Meeting.find(query).sort({ scheduledFor: 1 });

    const dueMeetings = meetings.filter((meeting) => {
      const scheduled = new Date(meeting.scheduledFor).getTime();
      const reminderAt = scheduled - (meeting.reminderMinutesBefore || 30) * 60 * 1000;
      const withinWindow = now.getTime() >= reminderAt && now.getTime() <= scheduled;
      if (!withinWindow) return false;
      if (!meeting.lastReminderSentAt) return true;
      return meeting.lastReminderSentAt.getTime() < reminderAt;
    });

    res.json({
      success: true,
      reminders: dueMeetings
    });
  } catch (error) {
    console.error('Get due reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reminders'
    });
  }
});

/**
 * @route   POST /api/meetings/mark-reminder-sent/:meetingId
 * @desc    Mark reminder as sent
 * @access  Private (Teacher)
 */
router.post('/mark-reminder-sent/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
      teacherId: req.user.userId
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or access denied'
      });
    }

    meeting.lastReminderSentAt = new Date();
    await meeting.save();

    res.json({
      success: true,
      message: 'Reminder marked as sent'
    });
  } catch (error) {
    console.error('Mark reminder sent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating reminder status'
    });
  }
});

/**
 * @route   GET /api/meetings/my-participated
 * @desc    Get all meetings student has participated in
 * @access  Private (Student)
 */
router.get('/my-participated', authenticateToken, authorizeStudent, async (req, res) => {
  try {
    const Analytics = require('../models/Analytics');

    const participations = await Participant.find({
      userId: req.user.userId
    }).sort({ joinTime: -1 });

    const meetings = await Promise.all(participations.map(async (p) => {
      const meeting = await Meeting.findOne({ meetingId: p.meetingId });
      if (!meeting) return null;

      const hasAnalytics = await Analytics.findOne({
        userId: req.user.userId,
        meetingId: p.meetingId
      });

      return {
        meetingId: meeting.meetingId,
        title: meeting.title,
        status: meeting.status,
        scheduledFor: meeting.scheduledFor,
        joinedAt: p.joinTime,
        leftAt: p.leaveTime,
        hasAnalytics: !!hasAnalytics,
        _id: meeting._id
      };
    }));

    const validMeetings = meetings.filter((m) => m !== null);

    res.json({
      success: true,
      meetings: validMeetings
    });
  } catch (error) {
    console.error('Get participated meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching meetings'
    });
  }
});

/**
 * @route   POST /api/meetings/start/:meetingId
 * @desc    Start meeting (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/start/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
      teacherId: req.user.userId
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    meeting.status = 'active';
    if (!meeting.actualStartTime) {
      meeting.actualStartTime = new Date();
    }
    await meeting.save();

    res.json({
      success: true,
      message: 'Meeting started successfully',
      meeting
    });
  } catch (error) {
    console.error('Start meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while starting meeting'
    });
  }
});

/**
 * @route   POST /api/meetings/end/:meetingId
 * @desc    End meeting (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/end/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
      teacherId: req.user.userId
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    meeting.status = 'ended';
    meeting.actualEndTime = new Date();
    await meeting.save();

    await Participant.updateMany(
      { meetingId: req.params.meetingId, isActive: true },
      { isActive: false, leaveTime: new Date() }
    );

    res.json({
      success: true,
      message: 'Meeting ended successfully',
      meeting
    });
  } catch (error) {
    console.error('End meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while ending meeting'
    });
  }
});

/**
 * @route   POST /api/meetings/join/:meetingId
 * @desc    Join meeting
 * @access  Private (Both)
 */
router.post('/join/:meetingId', authenticateToken, authorizeBoth, async (req, res) => {
  try {
    const { password } = req.body;
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    if (meeting.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Meeting is not active'
      });
    }

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

    const isTeacherHost = String(meeting.teacherId) === String(req.user.userId);

    const existingParticipant = await Participant.findOne({
      meetingId: req.params.meetingId,
      userId: req.user.userId
    });

    const waitingRoomActive = meeting.waitingRoomEnabled !== false;

    if (existingParticipant) {
      if (waitingRoomActive && !isTeacherHost && existingParticipant.status === 'waiting') {
        return res.json({
          success: true,
          message: 'Waiting for host approval',
          status: 'waiting',
          inWaitingRoom: true,
          meeting
        });
      }

      if (waitingRoomActive && !isTeacherHost && existingParticipant.status === 'rejected') {
        existingParticipant.status = 'waiting';
        existingParticipant.isActive = false;
        existingParticipant.admittedAt = null;
        existingParticipant.admittedBy = null;
        existingParticipant.joinTime = new Date();
        await existingParticipant.save();

        emitWaitingRoomEvent(req, 'waiting_user_added', {
          meetingId: req.params.meetingId,
          teacherId: String(meeting.teacherId),
          userId: String(req.user.userId),
          name: existingParticipant.userName,
          joinedAt: existingParticipant.joinTime,
          status: 'waiting'
        }, {
          teacherId: String(meeting.teacherId),
          meetingId: req.params.meetingId
        });

        emitWaitingRoomEvent(req, 'waiting-list-updated', {
          meetingId: req.params.meetingId
        }, {
          teacherId: String(meeting.teacherId),
          meetingId: req.params.meetingId
        });

        return res.json({
          success: true,
          message: 'Waiting for host approval',
          status: 'waiting',
          inWaitingRoom: true,
          meeting
        });
      }

      if (!isTeacherHost && !existingParticipant.isActive) {
        const activeStudentCount = await countActiveStudentParticipants(meeting);
        if (activeStudentCount >= MAX_STUDENTS_PER_MEETING) {
          return res.status(403).json({
            success: false,
            message: `Meeting is full. Maximum ${MAX_STUDENTS_PER_MEETING} students allowed.`
          });
        }
      }

      existingParticipant.status = 'admitted';
      existingParticipant.isActive = true;
      existingParticipant.admittedAt = existingParticipant.admittedAt || new Date();
      existingParticipant.admittedBy = existingParticipant.admittedBy || req.user.userId;
      await existingParticipant.save();

      return res.json({
        success: true,
        message: 'Joined meeting successfully',
        status: 'admitted',
        inWaitingRoom: false,
        meeting
      });
    }

    const shouldQueueStudent = waitingRoomActive && !isTeacherHost;

    if (!isTeacherHost && !shouldQueueStudent) {
      const activeStudentCount = await countActiveStudentParticipants(meeting);
      if (activeStudentCount >= MAX_STUDENTS_PER_MEETING) {
        return res.status(403).json({
          success: false,
          message: `Meeting is full. Maximum ${MAX_STUDENTS_PER_MEETING} students allowed.`
        });
      }
    }

    const participant = new Participant({
      meetingId: req.params.meetingId,
      userId: req.user.userId,
      userName: req.user.name || req.user.email,
      userEmail: req.user.email,
      status: shouldQueueStudent ? 'waiting' : 'admitted',
      admittedAt: shouldQueueStudent ? null : new Date(),
      admittedBy: shouldQueueStudent ? null : req.user.userId,
      isActive: !shouldQueueStudent
    });

    await participant.save();

    if (shouldQueueStudent) {
      emitWaitingRoomEvent(req, 'waiting_user_added', {
        meetingId: req.params.meetingId,
        teacherId: String(meeting.teacherId),
        userId: String(req.user.userId),
        name: participant.userName,
        joinedAt: participant.joinTime,
        status: 'waiting'
      }, {
        teacherId: String(meeting.teacherId),
        meetingId: req.params.meetingId
      });

      emitWaitingRoomEvent(req, 'waiting-list-updated', {
        meetingId: req.params.meetingId
      }, {
        teacherId: String(meeting.teacherId),
        meetingId: req.params.meetingId
      });

      return res.json({
        success: true,
        message: 'Waiting for host approval',
        status: 'waiting',
        inWaitingRoom: true,
        meeting
      });
    }

    res.json({
      success: true,
      message: 'Joined meeting successfully',
      status: 'admitted',
      inWaitingRoom: false,
      meeting
    });
  } catch (error) {
    console.error('Join meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while joining meeting'
    });
  }
});

/**
 * @route   GET /api/meetings/waiting-list/:meetingId
 * @desc    Get list of waiting participants (Teacher only)
 * @access  Private (Teacher)
 */
router.get('/waiting-list/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await ensureTeacherMeeting(req, res);
    if (!meeting) return;

    const waitingParticipants = await Participant.find({
      meetingId: req.params.meetingId,
      status: 'waiting'
    }).populate('userId', 'name email');

    res.json({
      success: true,
      waitingCount: waitingParticipants.length,
      waitingParticipants: waitingParticipants.map((p) => ({
        participantId: p._id,
        userId: p.userId ? p.userId._id : p.userId,
        name: p.userName,
        email: p.userEmail,
        requestTime: p.joinTime,
        status: p.status
      }))
    });
  } catch (error) {
    console.error('Get waiting list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching waiting list'
    });
  }
});

/**
 * @route   POST /api/meetings/admit/:meetingId/:participantId
 * @desc    Admit a waiting participant to meeting (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/admit/:meetingId/:participantId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await ensureTeacherMeeting(req, res);
    if (!meeting) return;

    const activeStudentCount = await countActiveStudentParticipants(meeting);
    if (activeStudentCount >= MAX_STUDENTS_PER_MEETING) {
      return res.status(403).json({
        success: false,
        message: `Meeting is full. Maximum ${MAX_STUDENTS_PER_MEETING} students allowed.`
      });
    }

    const participant = await Participant.findById(req.params.participantId);

    if (!participant || participant.meetingId !== req.params.meetingId || participant.status !== 'waiting') {
      return res.status(404).json({
        success: false,
        message: 'Participant not found in waiting room'
      });
    }

    participant.status = 'admitted';
    participant.admittedAt = new Date();
    participant.admittedBy = req.user.userId;
    participant.isActive = true;
    await participant.save();

    emitWaitingRoomEvent(req, 'admitted', {
      meetingId: req.params.meetingId,
      userId: String(participant.userId),
      participantId: String(participant._id)
    }, {
      userId: String(participant.userId),
      teacherId: String(meeting.teacherId),
      meetingId: req.params.meetingId
    });
    emitWaitingRoomEvent(req, 'waiting-list-updated', {
      meetingId: req.params.meetingId
    }, {
      teacherId: String(meeting.teacherId),
      meetingId: req.params.meetingId
    });

    res.json({
      success: true,
      message: 'Participant admitted to meeting',
      participant
    });
  } catch (error) {
    console.error('Admit participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while admitting participant'
    });
  }
});

/**
 * @route   POST /api/meetings/admit-all/:meetingId
 * @desc    Admit all waiting participants (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/admit-all/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await ensureTeacherMeeting(req, res);
    if (!meeting) return;

    const waitingUsers = await Participant.find({
      meetingId: req.params.meetingId,
      status: 'waiting'
    });

    const activeStudentCount = await countActiveStudentParticipants(meeting);
    const availableSlots = Math.max(0, MAX_STUDENTS_PER_MEETING - activeStudentCount);

    if (availableSlots <= 0) {
      return res.status(403).json({
        success: false,
        message: `Meeting is full. Maximum ${MAX_STUDENTS_PER_MEETING} students allowed.`
      });
    }

    const usersToAdmit = waitingUsers.slice(0, availableSlots);
    const admitIds = usersToAdmit.map((u) => u._id);

    const result = await Participant.updateMany(
      {
        meetingId: req.params.meetingId,
        _id: { $in: admitIds },
        status: 'waiting'
      },
      {
        status: 'admitted',
        admittedAt: new Date(),
        admittedBy: req.user.userId,
        isActive: true
      }
    );

    usersToAdmit.forEach((participant) => {
      emitWaitingRoomEvent(req, 'admitted', {
        meetingId: req.params.meetingId,
        userId: String(participant.userId),
        participantId: String(participant._id)
      }, {
        userId: String(participant.userId),
        teacherId: String(meeting.teacherId),
        meetingId: req.params.meetingId
      });
    });
    emitWaitingRoomEvent(req, 'waiting-list-updated', {
      meetingId: req.params.meetingId
    }, {
      teacherId: String(meeting.teacherId),
      meetingId: req.params.meetingId
    });

    res.json({
      success: true,
      message: `Admitted ${result.modifiedCount} participant(s)`,
      admittedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Admit all error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while admitting participants'
    });
  }
});

/**
 * @route   POST /api/meetings/reject/:meetingId/:participantId
 * @desc    Reject a waiting participant (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/reject/:meetingId/:participantId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await ensureTeacherMeeting(req, res);
    if (!meeting) return;

    const participant = await Participant.findById(req.params.participantId);

    if (!participant || participant.meetingId !== req.params.meetingId || participant.status !== 'waiting') {
      return res.status(404).json({
        success: false,
        message: 'Participant not found in waiting room'
      });
    }

    participant.status = 'rejected';
    participant.isActive = false;
    await participant.save();

    emitWaitingRoomEvent(req, 'rejected', {
      meetingId: req.params.meetingId,
      userId: String(participant.userId),
      participantId: String(participant._id)
    }, {
      userId: String(participant.userId),
      teacherId: String(meeting.teacherId),
      meetingId: req.params.meetingId
    });
    emitWaitingRoomEvent(req, 'waiting-list-updated', {
      meetingId: req.params.meetingId
    }, {
      teacherId: String(meeting.teacherId),
      meetingId: req.params.meetingId
    });

    res.json({
      success: true,
      message: 'Participant rejected',
      participant
    });
  } catch (error) {
    console.error('Reject participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting participant'
    });
  }
});

/**
 * @route   GET /api/meetings/waiting-room-status/:meetingId
 * @desc    Get waiting room status
 * @access  Private (Both)
 */
router.get('/waiting-room-status/:meetingId', authenticateToken, authorizeBoth, async (req, res) => {
  try {
    const participant = await Participant.findOne({
      meetingId: req.params.meetingId,
      userId: req.user.userId
    });

    if (!participant) {
      return res.json({
        success: true,
        status: 'not-joined',
        inWaitingRoom: false,
        isActive: false
      });
    }

    res.json({
      success: true,
      status: participant.status,
      inWaitingRoom: participant.status === 'waiting',
      isActive: participant.isActive
    });
  } catch (error) {
    console.error('Get waiting room status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking waiting room status'
    });
  }
});

/**
 * @route   GET /api/meetings/waiting-room/:meetingId
 * @desc    Get waiting room list (Teacher only)
 * @access  Private (Teacher)
 */
router.get('/waiting-room/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await ensureTeacherMeeting(req, res);
    if (!meeting) return;

    const waitingUsers = await Participant.find({
      meetingId: req.params.meetingId,
      status: 'waiting'
    }).sort({ joinTime: 1 });

    res.json({
      success: true,
      waitingRoom: waitingUsers.map((u) => ({
        userId: String(u.userId),
        name: u.userName,
        joinedAt: u.joinTime,
        status: 'waiting'
      }))
    });
  } catch (error) {
    console.error('Get waiting room error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching waiting room'
    });
  }
});

/**
 * @route   POST /api/meetings/waiting-room/admit
 * @desc    Admit user from waiting room (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/waiting-room/admit', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const { meetingId, userId } = req.body;
    if (!meetingId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'meetingId and userId are required'
      });
    }

    const meeting = await ensureTeacherMeetingById(meetingId, req.user.userId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or access denied'
      });
    }

    const activeStudentCount = await countActiveStudentParticipants(meeting);
    if (activeStudentCount >= MAX_STUDENTS_PER_MEETING) {
      return res.status(403).json({
        success: false,
        message: `Meeting is full. Maximum ${MAX_STUDENTS_PER_MEETING} students allowed.`
      });
    }

    const participant = await Participant.findOne({ meetingId, userId, status: 'waiting' });
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'User not found in waiting room'
      });
    }

    participant.status = 'admitted';
    participant.admittedAt = new Date();
    participant.admittedBy = req.user.userId;
    participant.isActive = true;
    await participant.save();

    emitWaitingRoomEvent(req, 'admitted', {
      meetingId,
      userId: String(participant.userId),
      participantId: String(participant._id)
    }, {
      userId: String(participant.userId),
      teacherId: String(meeting.teacherId),
      meetingId
    });
    emitWaitingRoomEvent(req, 'waiting-list-updated', { meetingId }, {
      teacherId: String(meeting.teacherId),
      meetingId
    });

    res.json({
      success: true,
      message: 'User admitted',
      participant
    });
  } catch (error) {
    console.error('Waiting room admit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while admitting user'
    });
  }
});

/**
 * @route   POST /api/meetings/waiting-room/reject
 * @desc    Reject user from waiting room (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/waiting-room/reject', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const { meetingId, userId } = req.body;
    if (!meetingId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'meetingId and userId are required'
      });
    }

    const meeting = await ensureTeacherMeetingById(meetingId, req.user.userId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or access denied'
      });
    }

    const participant = await Participant.findOne({ meetingId, userId, status: 'waiting' });
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'User not found in waiting room'
      });
    }

    participant.status = 'rejected';
    participant.isActive = false;
    await participant.save();

    emitWaitingRoomEvent(req, 'rejected', {
      meetingId,
      userId: String(participant.userId),
      participantId: String(participant._id)
    }, {
      userId: String(participant.userId),
      teacherId: String(meeting.teacherId),
      meetingId
    });
    emitWaitingRoomEvent(req, 'waiting-list-updated', { meetingId }, {
      teacherId: String(meeting.teacherId),
      meetingId
    });

    res.json({
      success: true,
      message: 'User rejected'
    });
  } catch (error) {
    console.error('Waiting room reject error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting user'
    });
  }
});

/**
 * @route   POST /api/meetings/waiting-room/admit-all
 * @desc    Admit all users from waiting room (Teacher only)
 * @access  Private (Teacher)
 */
router.post('/waiting-room/admit-all', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const { meetingId } = req.body;
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: 'meetingId is required'
      });
    }

    const meeting = await ensureTeacherMeetingById(meetingId, req.user.userId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or access denied'
      });
    }

    const waitingUsers = await Participant.find({ meetingId, status: 'waiting' });

    const activeStudentCount = await countActiveStudentParticipants(meeting);
    const availableSlots = Math.max(0, MAX_STUDENTS_PER_MEETING - activeStudentCount);

    if (availableSlots <= 0) {
      return res.status(403).json({
        success: false,
        message: `Meeting is full. Maximum ${MAX_STUDENTS_PER_MEETING} students allowed.`
      });
    }

    const usersToAdmit = waitingUsers.slice(0, availableSlots);
    const admitIds = usersToAdmit.map((u) => u._id);

    const result = await Participant.updateMany(
      { meetingId, _id: { $in: admitIds }, status: 'waiting' },
      {
        status: 'admitted',
        admittedAt: new Date(),
        admittedBy: req.user.userId,
        isActive: true
      }
    );

    usersToAdmit.forEach((participant) => {
      emitWaitingRoomEvent(req, 'admitted', {
        meetingId,
        userId: String(participant.userId),
        participantId: String(participant._id)
      }, {
        userId: String(participant.userId),
        teacherId: String(meeting.teacherId),
        meetingId
      });
    });
    emitWaitingRoomEvent(req, 'waiting-list-updated', { meetingId }, {
      teacherId: String(meeting.teacherId),
      meetingId
    });

    res.json({
      success: true,
      admittedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Waiting room admit-all error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while admitting users'
    });
  }
});

/**
 * @route   GET /api/meetings/participants/:meetingId
 * @desc    Get meeting participants (Teacher only)
 * @access  Private (Teacher)
 */
router.get('/participants/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await ensureTeacherMeeting(req, res);
    if (!meeting) return;

    const participants = await Participant.find({
      meetingId: req.params.meetingId,
      status: 'admitted'
    }).populate('userId', 'name email');

    res.json({
      success: true,
      participants
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching participants'
    });
  }
});

/**
 * @route   GET /api/meetings/attendance/:meetingId
 * @desc    Get meeting attendance data (JSON format)
 * @access  Private (Teacher only)
 */
router.get('/attendance/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const meeting = await ensureTeacherMeeting(req, res);
    if (!meeting) return;

    const participants = await Participant.find({
      meetingId: req.params.meetingId,
      status: { $in: ['admitted', 'rejected'] }
    });

    const attendanceData = participants.map((p) => {
      const joinTime = new Date(p.joinTime);
      const leaveTime = p.leaveTime ? new Date(p.leaveTime) : new Date();
      const duration = Math.round((leaveTime - joinTime) / 60000);

      return {
        name: p.userName,
        joinTime: joinTime.toLocaleString('en-US', { timeZone: 'UTC' }),
        leaveTime: p.leaveTime ? leaveTime.toLocaleString('en-US', { timeZone: 'UTC' }) : 'Still in meeting',
        durationMinutes: duration,
        status: p.isActive ? 'Active' : 'Left'
      };
    });

    res.json({
      success: true,
      attendance: {
        meetingTitle: meeting.title,
        meetingId: meeting.meetingId,
        teacherName: meeting.teacherName,
        startTime: meeting.actualStartTime ? new Date(meeting.actualStartTime).toLocaleString() : 'Not started',
        endTime: meeting.actualEndTime ? new Date(meeting.actualEndTime).toLocaleString() : 'Ongoing',
        totalParticipants: participants.length,
        participants: attendanceData
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance'
    });
  }
});

/**
 * @route   GET /api/meetings/download-attendance/:meetingId
 * @desc    Download attendance report as PDF or CSV
 * @access  Private (Teacher only)
 * @query   format: 'pdf' or 'csv' (default: pdf)
 */
router.get('/download-attendance/:meetingId', authenticateToken, authorizeTeacher, async (req, res) => {
  try {
    const format = req.query.format || 'pdf';

    const meeting = await ensureTeacherMeeting(req, res);
    if (!meeting) return;

    const participants = await Participant.find({
      meetingId: req.params.meetingId,
      status: { $in: ['admitted', 'rejected'] }
    });

    if (format === 'csv') {
      generateCSV(res, meeting, participants);
    } else {
      generatePDF(res, meeting, participants);
    }
  } catch (error) {
    console.error('Download attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating report'
    });
  }
});

function generateCSV(res, meeting, participants) {
  const { stringify } = require('csv-stringify/sync');

  const rows = [
    ['ATTENDANCE REPORT'],
    ['Meeting Title', meeting.title],
    ['Meeting ID', meeting.meetingId],
    ['Teacher', meeting.teacherName],
    ['Start Time', meeting.actualStartTime ? new Date(meeting.actualStartTime).toLocaleString() : 'Not started'],
    ['End Time', meeting.actualEndTime ? new Date(meeting.actualEndTime).toLocaleString() : 'Ongoing'],
    ['Total Participants', participants.length],
    [],
    ['Student Name', 'Join Time', 'Leave Time', 'Duration (Minutes)', 'Status']
  ];

  participants.forEach((p) => {
    const joinTime = new Date(p.joinTime);
    const leaveTime = p.leaveTime ? new Date(p.leaveTime) : new Date();
    const duration = Math.round((leaveTime - joinTime) / 60000);

    rows.push([
      p.userName,
      joinTime.toLocaleString(),
      p.leaveTime ? leaveTime.toLocaleString() : 'Still in meeting',
      duration,
      p.isActive ? 'Active' : 'Left'
    ]);
  });

  const csv = stringify(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${meeting.meetingId}.csv"`);
  res.send(csv);
}

function generatePDF(res, meeting, participants) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${meeting.meetingId}.pdf"`);

  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text('ATTENDANCE REPORT', { align: 'center' });
  doc.moveDown(0.3);

  doc.fontSize(11).font('Helvetica')
    .text(`Meeting Title: ${meeting.title}`)
    .text(`Meeting ID: ${meeting.meetingId}`)
    .text(`Teacher: ${meeting.teacherName}`)
    .text(`Start Time: ${meeting.actualStartTime ? new Date(meeting.actualStartTime).toLocaleString() : 'Not started'}`)
    .text(`End Time: ${meeting.actualEndTime ? new Date(meeting.actualEndTime).toLocaleString() : 'Ongoing'}`)
    .text(`Total Participants: ${participants.length}`);

  doc.moveDown(0.5);

  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 200;
  const col3 = 330;
  const col4 = 440;
  const rowHeight = 25;

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Student Name', col1, tableTop);
  doc.text('Join Time', col2, tableTop);
  doc.text('Duration (Min)', col3, tableTop);
  doc.text('Status', col4, tableTop);

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  let yPosition = tableTop + 25;
  doc.fontSize(9).font('Helvetica');

  participants.forEach((p) => {
    const joinTime = new Date(p.joinTime);
    const leaveTime = p.leaveTime ? new Date(p.leaveTime) : new Date();
    const duration = Math.round((leaveTime - joinTime) / 60000);

    doc.text(p.userName, col1, yPosition);
    doc.text(joinTime.toLocaleString(), col2, yPosition);
    doc.text(duration.toString(), col3, yPosition);
    doc.text(p.isActive ? 'Active' : 'Left', col4, yPosition);

    yPosition += rowHeight;

    if (yPosition > 750) {
      doc.addPage();
      yPosition = 50;
    }
  });

  doc.moveDown();
  doc.fontSize(9).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

  doc.end();
}

module.exports = router;
