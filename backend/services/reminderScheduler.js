/**
 * Reminder scheduler
 * Scans for due meetings and sends SMTP reminders
 */

const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { sendMeetingReminderEmail, getMailerConfig, canSendEmail } = require('./mailer');

let isRunning = false;

async function collectRecipients(meeting) {
  const recipients = new Set();

  // Teacher gets reminder
  if (meeting.teacherName && meeting.teacherName.includes('@')) {
    recipients.add(meeting.teacherName.toLowerCase());
  }

  // Student reminders: broadcast to registered student users (project has open join model)
  const students = await User.find({ role: 'student' }).select('email');
  students.forEach((student) => {
    if (student.email) {
      recipients.add(student.email.toLowerCase());
    }
  });

  return Array.from(recipients);
}

function isReminderDue(meeting, now) {
  if (!meeting.reminderEnabled || !meeting.scheduledFor || meeting.status !== 'scheduled') {
    return false;
  }

  const startTime = new Date(meeting.scheduledFor).getTime();
  const minutesBefore = meeting.reminderMinutesBefore || 30;
  const reminderTime = startTime - minutesBefore * 60 * 1000;
  const nowTime = now.getTime();

  // Send in 90-second window to avoid precision misses in interval polling.
  const inWindow = nowTime >= reminderTime && nowTime <= reminderTime + 90 * 1000;
  if (!inWindow) return false;

  if (!meeting.lastReminderSentAt) return true;
  return meeting.lastReminderSentAt.getTime() < reminderTime;
}

async function runReminderDispatch() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  try {
    const config = getMailerConfig();
    if (!canSendEmail(config)) {
      return;
    }

    const now = new Date();
    const meetings = await Meeting.find({
      status: 'scheduled',
      reminderEnabled: true,
      scheduledFor: { $ne: null }
    }).sort({ scheduledFor: 1 }).limit(300);

    for (const meeting of meetings) {
      if (!isReminderDue(meeting, now)) {
        continue;
      }

      const recipients = await collectRecipients(meeting);
      if (!recipients.length) {
        continue;
      }

      let sentCount = 0;
      for (const email of recipients) {
        try {
          await sendMeetingReminderEmail({
            to: email,
            meetingTitle: meeting.title,
            meetingId: meeting.meetingId,
            scheduledFor: meeting.scheduledFor,
            minutesBefore: meeting.reminderMinutesBefore || 30,
            teacherName: meeting.teacherName
          });
          sentCount += 1;
        } catch (sendError) {
          console.error(`Reminder email failed for ${email}:`, sendError.message);
        }
      }

      if (sentCount > 0) {
        meeting.lastReminderSentAt = new Date();
        await meeting.save();
        console.log(`Reminder sent for ${meeting.meetingId} to ${sentCount} recipient(s)`);
      }
    }
  } catch (error) {
    console.error('Reminder scheduler error:', error);
  } finally {
    isRunning = false;
  }
}

function startReminderScheduler() {
  // Run once quickly after boot, then every minute.
  setTimeout(() => {
    runReminderDispatch().catch((err) => console.error('Initial reminder run failed:', err));
  }, 10 * 1000);

  setInterval(() => {
    runReminderDispatch().catch((err) => console.error('Scheduled reminder run failed:', err));
  }, 60 * 1000);
}

module.exports = {
  startReminderScheduler,
  runReminderDispatch
};
