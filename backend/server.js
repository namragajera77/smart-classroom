/**
 * Main Server File
 * Smart Online Classroom & Meeting Platform
 * Features: WebRTC signaling, JWT auth, RBAC, Behavioral Analytics
 */

require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const Meeting = require('./models/Meeting');
const Participant = require('./models/Participant');

const MAX_MEETING_DURATION_MS = 2 * 60 * 60 * 1000;
const AUTO_END_WARNING_BEFORE_MS = 10 * 60 * 1000;
const warnedMeetings = new Set();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for WebRTC signaling
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

// Connect to MongoDB
connectDB();

async function monitorMeetingDurations() {
  try {
    const now = new Date();
    const activeMeetings = await Meeting.find({
      status: 'active',
      actualStartTime: { $ne: null }
    }).select('meetingId title actualStartTime status actualEndTime');

    for (const meeting of activeMeetings) {
      const startMs = new Date(meeting.actualStartTime).getTime();
      if (Number.isNaN(startMs)) continue;

      const elapsedMs = now.getTime() - startMs;
      const remainingMs = MAX_MEETING_DURATION_MS - elapsedMs;

      if (remainingMs <= 0) {
        meeting.status = 'ended';
        meeting.actualEndTime = now;
        await meeting.save();

        await Participant.updateMany(
          { meetingId: meeting.meetingId, isActive: true },
          { isActive: false, leaveTime: now }
        );

        io.to(meeting.meetingId).emit('meeting-auto-ended', {
          meetingId: meeting.meetingId,
          endedAt: now,
          message: 'Meeting ended automatically after 2 hours.'
        });

        warnedMeetings.delete(meeting.meetingId);
        continue;
      }

      if (remainingMs <= AUTO_END_WARNING_BEFORE_MS && !warnedMeetings.has(meeting.meetingId)) {
        warnedMeetings.add(meeting.meetingId);
        io.to(meeting.meetingId).emit('meeting-ending-warning', {
          meetingId: meeting.meetingId,
          remainingMinutes: Math.ceil(remainingMs / 60000),
          message: 'Meeting will auto-end in 10 minutes.'
        });
      }
    }
  } catch (error) {
    console.error('Meeting duration monitor error:', error);
  }
}

setTimeout(() => {
  monitorMeetingDurations().catch((err) => console.error('Initial meeting monitor failed:', err));
}, 10000);

setInterval(() => {
  monitorMeetingDurations().catch((err) => console.error('Meeting monitor interval failed:', err));
}, 60000);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/polls', require('./routes/polls'));

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Smart Classroom Platform API is running',
    timestamp: new Date()
  });
});

// WebRTC Signaling with Socket.IO
const rooms = {}; // Store room participants

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('register-user', ({ userId }) => {
    if (!userId) return;
    socket.join(`user:${userId}`);
  });

  // Join meeting room
  socket.on('join-room', ({ meetingId, userId, userName }) => {
    socket.join(meetingId);
    
    if (!rooms[meetingId]) {
      rooms[meetingId] = [];
    }
    
    rooms[meetingId].push({ 
      socketId: socket.id, 
      userId, 
      userName,
      audioEnabled: true,
      videoEnabled: true
    });

    // Notify others in the room
    socket.to(meetingId).emit('user-joined', { 
      socketId: socket.id, 
      userId, 
      userName 
    });

    // Send current participants to the new user
    socket.emit('room-users', rooms[meetingId]);

    console.log(`User ${userName} joined meeting ${meetingId}`);
  });

  // WebRTC Signaling: Offer
  socket.on('offer', ({ offer, to, userName }) => {
    socket.to(to).emit('offer', { offer, from: socket.id, userName });
  });

  // WebRTC Signaling: Answer
  socket.on('answer', ({ answer, to, userName }) => {
    socket.to(to).emit('answer', { answer, from: socket.id, userName });
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', ({ candidate, to }) => {
    socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Chat message
  socket.on('chat-message', ({ meetingId, message, userName }) => {
    io.to(meetingId).emit('chat-message', {
      userName,
      message,
      timestamp: new Date()
    });
  });

  // Chat file message
  socket.on('chat-file', ({ meetingId, userName, file }) => {
    io.to(meetingId).emit('chat-file', {
      userName,
      file,
      timestamp: new Date()
    });
  });

  // Student raise/lower hand
  socket.on('student-hand', ({ meetingId, raised, userName }) => {
    io.to(meetingId).emit('student-hand', {
      socketId: socket.id,
      userName,
      raised: Boolean(raised),
      timestamp: new Date()
    });
  });

  // Teacher acknowledges student's raised hand
  socket.on('teacher-acknowledge-hand', ({ meetingId, studentSocketId, studentName }) => {
    io.to(meetingId).emit('teacher-lower-hand', {
      studentSocketId,
      studentName,
      acknowledgedAt: new Date()
    });
  });

  // Toggle audio
  socket.on('toggle-audio', ({ meetingId, enabled }) => {
    const room = rooms[meetingId];
    if (room) {
      const user = room.find(u => u.socketId === socket.id);
      if (user) {
        user.audioEnabled = enabled;
        socket.to(meetingId).emit('user-audio-toggle', { 
          socketId: socket.id, 
          enabled 
        });
      }
    }
  });

  // Toggle video
  socket.on('toggle-video', ({ meetingId, enabled }) => {
    const room = rooms[meetingId];
    if (room) {
      const user = room.find(u => u.socketId === socket.id);
      if (user) {
        user.videoEnabled = enabled;
        socket.to(meetingId).emit('user-video-toggle', { 
          socketId: socket.id, 
          enabled 
        });
      }
    }
  });

  // Student requests permission to share screen
  socket.on('request-screen-share', ({ meetingId, userName }) => {
    socket.to(meetingId).emit('screen-share-requested', {
      requesterSocketId: socket.id,
      userName,
      requestedAt: new Date()
    });
  });

  // Teacher responds to a screen share request
  socket.on('respond-screen-share-request', ({ meetingId, requesterSocketId, approved, teacherName }) => {
    io.to(requesterSocketId).emit('screen-share-request-response', {
      approved: Boolean(approved),
      teacherName,
      meetingId,
      respondedAt: new Date()
    });

    socket.to(meetingId).emit('screen-share-request-resolved', {
      requesterSocketId,
      approved: Boolean(approved),
      teacherName,
      resolvedAt: new Date()
    });
  });

  // Broadcast screen sharing status to everyone in the room
  socket.on('screen-share-status', ({ meetingId, isSharing, userName }) => {
    io.to(meetingId).emit('screen-share-status', {
      sharerSocketId: socket.id,
      userName,
      isSharing: Boolean(isSharing),
      updatedAt: new Date()
    });
  });

  // Poll: Teacher creates and broadcasts poll
  socket.on('create-poll', ({ meetingId, pollId, title, question, options }) => {
    io.to(meetingId).emit('poll-created', {
      pollId,
      title,
      question,
      options,
      createdAt: new Date()
    });
  });

  // Poll: Student submits answer
  socket.on('poll-answer-submitted', ({ meetingId, pollId, userName }) => {
    socket.to(meetingId).emit('poll-response-received', {
      pollId,
      userName,
      timestamp: new Date()
    });
  });

  // Poll: Teacher closes poll and optionally shows results
  socket.on('close-poll', ({ meetingId, pollId, showResults }) => {
    io.to(meetingId).emit('poll-closed', {
      pollId,
      showResults,
      closedAt: new Date()
    });
  });

  // Poll: Teacher toggles result visibility while/after poll runs
  socket.on('set-poll-visibility', ({ meetingId, pollId, showResults }) => {
    io.to(meetingId).emit('poll-visibility-updated', {
      pollId,
      showResults: Boolean(showResults),
      updatedAt: new Date()
    });
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log('❌ User disconnected:', socket.id);
    
    // Remove user from all rooms
    Object.keys(rooms).forEach(async (meetingId) => {
      const userIndex = rooms[meetingId].findIndex(u => u.socketId === socket.id);
      if (userIndex !== -1) {
        const user = rooms[meetingId][userIndex];
        rooms[meetingId].splice(userIndex, 1);
        
        // Update participant status in database
        try {
          await Participant.updateMany(
            { 
              meetingId: meetingId,
              userId: user.userId,
              isActive: true 
            },
            { 
              isActive: false, 
              leaveTime: new Date() 
            }
          );
          console.log(`Updated participant status for user ${user.userName}`);
        } catch (error) {
          console.error('Error updating participant on disconnect:', error);
        }
        
        // Notify others
        socket.to(meetingId).emit('user-left', { 
          socketId: socket.id,
          userName: user.userName
        });

        // Clean up empty rooms
        if (rooms[meetingId].length === 0) {
          delete rooms[meetingId];
        }
      }
    });
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebRTC signaling ready`);
  console.log(`🔐 JWT authentication enabled`);
  console.log(`🛡️  RBAC middleware active`);
});
