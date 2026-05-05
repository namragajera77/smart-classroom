/**
 * SMTP mailer service
 * Sends meeting reminder emails using nodemailer
 */

const nodemailer = require('nodemailer');

function getMailerConfig() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    SMTP_REQUIRE_TLS
  } = process.env;

  return {
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    from: SMTP_FROM || SMTP_USER || 'no-reply@smartclassroom.local',
    requireTLS: SMTP_REQUIRE_TLS === 'true'
  };
}

function canSendEmail(config) {
  return Boolean(config.host && config.port && config.from);
}

function createTransporter() {
  const config = getMailerConfig();
  if (!canSendEmail(config)) {
    return { transporter: null, config };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    requireTLS: config.requireTLS
  });

  return { transporter, config };
}

async function sendMeetingReminderEmail({ to, meetingTitle, meetingId, scheduledFor, minutesBefore, teacherName }) {
  const { transporter, config } = createTransporter();

  if (!transporter) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const startText = scheduledFor ? new Date(scheduledFor).toLocaleString() : 'soon';

  const subject = `Reminder: ${meetingTitle} starts in ${minutesBefore} minutes`;
  const text = [
    `Hello,`,
    '',
    `This is a reminder that your class meeting is starting in ${minutesBefore} minutes.`,
    `Title: ${meetingTitle}`,
    `Meeting ID: ${meetingId}`,
    `Teacher: ${teacherName || 'N/A'}`,
    `Scheduled Time: ${startText}`,
    '',
    'Please be ready to join on time.',
    '',
    'Smart Classroom Platform'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px 0;">Class Reminder</h2>
      <p>Your class meeting starts in <strong>${minutesBefore} minutes</strong>.</p>
      <table style="border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:4px 8px 4px 0;"><strong>Title</strong></td><td>${meetingTitle}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;"><strong>Meeting ID</strong></td><td>${meetingId}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;"><strong>Teacher</strong></td><td>${teacherName || 'N/A'}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;"><strong>Scheduled Time</strong></td><td>${startText}</td></tr>
      </table>
      <p>Please be ready to join on time.</p>
      <p style="color:#666;font-size:12px;">Smart Classroom Platform</p>
    </div>
  `;

  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html
  });

  return { sent: true };
}

module.exports = {
  getMailerConfig,
  canSendEmail,
  sendMeetingReminderEmail
};
