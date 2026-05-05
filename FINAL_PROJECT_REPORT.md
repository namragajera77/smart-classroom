# Smart Online Classroom Platform
## Comprehensive Project Report

## 1. Project Information
- Project Title: Smart Online Classroom & Meeting Platform with Behavioral Analytics
- Project Type: Full-Stack Web Application (College Mini Project)
- Domain: EdTech / Virtual Classroom
- Stack: Node.js, Express, MongoDB, Socket.IO, WebRTC, Python Flask, Scikit-learn
- Report Version: 1.0
- Report Date: March 2026

## 2. Abstract
This project is a full-stack online classroom platform designed for teachers and students. It provides secure role-based access, real-time video meetings, live chat, waiting room control, screen-sharing workflow, polling, meeting scheduling, and attendance reporting. The system also includes a machine learning service that predicts attention status and engagement from privacy-safe behavioral metrics such as idle time, tab switching, and session duration.

Unlike invasive analytics systems, this platform follows a privacy-first design and does not perform face detection, emotion recognition, or audio/video content analysis.

## 3. Problem Statement
Traditional online meeting tools support communication but provide limited learning-focused insights and weak classroom control. Educational institutions require:
- Role-specific controls for teachers and students
- Attendance visibility and export
- Structured scheduling and reminders
- Classroom moderation (waiting room, permissions)
- Practical analytics that preserve student privacy

This project addresses these needs in one integrated platform.

## 4. Objectives
- Build a secure virtual classroom system with RBAC.
- Enable live meetings with WebRTC and Socket.IO.
- Support teacher moderation features (waiting room, approvals, meeting control).
- Provide scheduling and calendar visibility with recurring meeting support.
- Add engagement tools such as poll/quiz and hand raise.
- Generate analytics using ML from behavioral data.
- Maintain privacy by avoiding camera/audio content analysis.

## 5. Key Features Implemented

### 5.1 Authentication and RBAC
- User registration and login with JWT.
- Password hashing using bcryptjs.
- Two roles:
  - Teacher: create/manage meetings, control class, view class analytics.
  - Student: join meetings, participate, view personal analytics.

### 5.2 Meeting Lifecycle
- Teacher creates meetings.
- Meeting states: scheduled, active, ended.
- Teacher can start/end active sessions.
- Students join via meeting ID.
- Meeting password protection available.

### 5.3 Waiting Room
- Students can be queued before admission.
- Teacher can admit, reject, or admit all.
- Real-time waiting list updates using sockets.
- Student waiting overlay and teacher waiting panel are role-separated.

### 5.4 Real-Time Classroom
- WebRTC audio/video conferencing.
- Mute/unmute, camera toggle.
- Real-time chat messages.
- Chat file sharing with upload validation.

### 5.5 Screen Sharing Workflow
- Teacher can share screen directly.
- Student requests screen-share permission.
- Teacher receives explicit approve/reject option.
- Request resolution is pushed in real-time to requester.

### 5.6 Poll/Quiz
- Teacher creates poll with options.
- Students answer in real-time.
- Result visibility can be controlled.
- Poll close and export support.
- Duplicate answer protection implemented.

### 5.7 Meeting Scheduler and Calendar
- Teachers schedule future meetings.
- Recurrence support: daily, weekly, monthly.
- Student and teacher upcoming views.
- Calendar grouping by date.
- Reminder metadata support.
- Scheduled meeting cancellation from teacher dashboard.

### 5.8 Attendance and Reports
- Participant join/leave tracking.
- Attendance endpoint and downloadable PDF/CSV exports.

### 5.9 Behavioral Analytics and ML
- Metrics captured: study duration, idle time, break count, tab switch count.
- Flask ML service predicts:
  - attention_status
  - engagement_score
  - cognitive_load
  - suggestion
- Teacher class view and student personal view analytics dashboards.

## 6. Privacy and Security Design
- No audio/video content analysis.
- Analytics from behavioral metrics only.
- JWT authentication for protected APIs.
- Role-based middleware authorization.
- Meeting password protection for controlled access.
- Waiting room moderation for host control.
- Input validation and duplicate checks in key flows.

## 7. Technology Stack

### Frontend
- HTML, CSS, JavaScript (Vanilla)
- WebRTC APIs
- Socket.IO client

### Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.IO
- JWT, bcryptjs
- Multer, Nodemailer, PDFKit, CSV tools

### ML Service
- Python Flask
- Scikit-learn RandomForestClassifier
- NumPy, Pandas, Joblib

## 8. System Architecture

Client Layer:
- login page
- teacher dashboard
- student dashboard
- meeting room
- analytics pages

Application Layer:
- Express REST APIs
- Socket.IO signaling and real-time events
- RBAC middleware and authentication

Data Layer:
- MongoDB collections for users, meetings, participants, polls, analytics

Intelligence Layer:
- Flask ML service exposing /predict and /health

## 9. Project Structure

- backend
  - config: db connection
  - middleware: auth, rbac
  - models: User, Meeting, Participant, Analytics, Poll, PollAnswer
  - routes: auth, meetings, analytics, polls
  - server.js: API server + socket events
- frontend
  - login.html
  - teacher-dashboard.html
  - student-dashboard.html
  - meeting-room.html
  - teacher-analytics.html
  - student-analytics.html
- ml-service
  - app.py
  - requirements.txt
  - training_data.csv
  - generate_dataset.py

## 10. Database Model Summary

### User
- name, email, password(hash), role

### Meeting
- meetingId, title, description
- teacherId, teacherName
- status
- scheduledFor, date, startTime, endTime
- isRecurring, recurrenceType, recurrenceCount, recurringSeriesId
- reminderEnabled, reminderMinutesBefore, lastReminderSentAt
- isPasswordProtected, password
- waitingRoomEnabled
- actualStartTime, actualEndTime
- createdAt

### Participant
- meetingId, userId, userName, userEmail
- joinTime, leaveTime
- status (waiting/admitted/rejected)
- isActive

### Analytics
- meetingId, userId
- behavioral metrics
- ML prediction output fields

### Poll and PollAnswer
- poll metadata, options, visibility flags
- answer tracking per user/poll

## 11. REST API Summary
Base URL: /api

### Auth Routes
- POST /auth/register
- POST /auth/login

### Meetings Routes (high-value)
- POST /meetings/create
- POST /meetings/schedule
- GET /meetings/my-meetings
- GET /meetings/upcoming
- GET /meetings/calendar
- DELETE /meetings/meeting/:id
- POST /meetings/start/:meetingId
- POST /meetings/end/:meetingId
- POST /meetings/join/:meetingId
- GET /meetings/my-participated
- GET /meetings/waiting-room/:meetingId
- POST /meetings/waiting-room/admit
- POST /meetings/waiting-room/reject
- POST /meetings/waiting-room/admit-all
- GET /meetings/waiting-room-status/:meetingId
- GET /meetings/attendance/:meetingId
- GET /meetings/download-attendance/:meetingId
- POST /meetings/chat-upload/:meetingId
- GET /meetings/due-reminders
- POST /meetings/mark-reminder-sent/:meetingId

### Poll Routes
- POST /polls/create
- POST /polls/submit-answer
- GET /polls/:pollId/results
- POST /polls/:pollId/close
- PATCH /polls/:pollId/visibility
- GET /polls/meeting/:meetingId
- GET /polls/:pollId/export

### Analytics Routes
- POST /analytics/submit
- GET /analytics/my-stats/:meetingId
- GET /analytics/class/:meetingId

## 12. Socket Events Summary
Core real-time events include:
- register-user, join-room, disconnect
- offer, answer, ice-candidate
- chat-message, chat-file
- student-hand, teacher-acknowledge-hand, teacher-lower-hand
- toggle-audio, toggle-video, user-audio-toggle, user-video-toggle
- request-screen-share, respond-screen-share-request, screen-share-status
- create-poll, poll-answer-submitted, close-poll, set-poll-visibility

## 13. ML Service Details
- Endpoint: GET /health
- Endpoint: POST /predict
- Model: RandomForestClassifier
- Trains on dataset (training_data.csv) if model file not present.
- Returns confidence, engagement score, cognitive load, and suggestion.

## 14. Setup and Execution

### Prerequisites
- Node.js 16+
- Python 3.8+
- MongoDB

### Install
1. npm install
2. Configure .env (MongoDB URI, JWT secret, ML service URL, SMTP)
3. Create Python venv in ml-service
4. pip install -r ml-service/requirements.txt

### Run
1. Backend: npm start
2. ML service: python ml-service/app.py
3. Frontend: open frontend/login.html (or local server)

## 15. User Flow

### Teacher Flow
1. Register/Login as teacher.
2. Create or schedule meeting.
3. Start meeting and join room.
4. Manage waiting room and permissions.
5. Use polling and screen-share moderation.
6. End meeting.
7. View analytics and export attendance.

### Student Flow
1. Register/Login as student.
2. Join via meeting ID (and password if required).
3. Wait for admission if waiting room enabled.
4. Participate in chat, polls, and class activities.
5. Submit analytics at session end.
6. View personal analytics report.

## 16. Validation and Testing Checklist
- Authentication tests for valid/invalid login.
- RBAC tests for teacher-only routes.
- Meeting lifecycle tests (create/start/join/end).
- Waiting room admit/reject/admit-all flows.
- Student screen-share request and teacher decision.
- Poll create/answer/close/visibility/export.
- Scheduler recurring creation and calendar rendering.
- Attendance PDF/CSV download.
- ML prediction and analytics rendering.

## 17. Outcomes and Impact
- Built an end-to-end virtual classroom with practical control tools.
- Added educational engagement capabilities beyond basic video calls.
- Demonstrated full-stack integration of real-time systems and ML.
- Preserved privacy while still generating actionable insights.

## 18. Limitations
- Frontend uses vanilla JS pages; no SPA routing/state framework.
- Advanced production hardening (rate limiting, distributed signaling scale) can be expanded.
- Automated test suite can be added for CI-level coverage.

## 19. Future Enhancements
- Breakout rooms and collaborative whiteboard
- Session recording and transcription
- Advanced dashboards and trend analytics
- Notification center and push reminders
- Containerized deployment and monitoring

## 20. Conclusion
The Smart Online Classroom Platform successfully combines real-time classroom interaction, role-based governance, scheduling, moderation, and privacy-first analytics in a single solution. It is suitable as a strong academic mini-project and demonstrates practical engineering across frontend, backend, real-time communication, data management, and machine learning integration.

## 21. Appendix: Dependency Snapshot

### Node.js Dependencies
- axios, bcryptjs, cors, csv-parse, csv-stringify
- dotenv, express, jsonwebtoken, mongoose
- multer, nodemailer, pdfkit, socket.io
- nodemon (dev)

### Python Dependencies
- flask
- flask-cors
- scikit-learn
- numpy
- pandas
- joblib
