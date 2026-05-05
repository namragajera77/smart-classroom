# Viva Report — Smart Classroom

Date: 2026-05-04

This document summarizes the actual implementation of the project's features (what was implemented, where the code lives, and how it works). Use this for your viva.

---

## 1. Project Overview

Smart Classroom is a real-time online teaching platform using Node.js/Express backend, MongoDB (Mongoose), Socket.IO signalling, and browser WebRTC (RTCPeerConnection) for video/audio. The frontend is static HTML/JS files under `frontend/`.

Core runtime components:
- Backend API & socket server: `backend/server.js`
- Meeting logic & routes: `backend/routes/meetings.js`
- Authentication: `backend/routes/auth.js`
- User model: `backend/models/User.js`
- Frontend meeting UI / signalling: `frontend/meeting-room.html`
- Analytics UIs: `frontend/student-analytics.html`, `frontend/teacher-analytics.html`

---

## 2. Features Implemented (summary)

1. Real-time audio/video meetings (WebRTC mesh) — frontend + Socket.IO signalling
2. Meeting waiting-room with teacher admission
3. Meeting capacity enforcement (Max 50 students)
4. Auto-end meetings after 2 hours + 10-minute warning
5. Multi-teacher assignment for students (select at registration)
6. Focus/behavioral analytics (now includes seconds) and analytics pages
7. Recurring meeting functionality removed (single-instance only)
8. Notifications and backend reminder scheduler removed
9. Screen sharing with teacher approval workflow
10. Multi-camera / multi-participant stability fix (offer-initiation ordering)

---

## 3. Feature-by-feature: implementation details and files

- Real-time audio/video meetings (WebRTC + Socket.IO)
  - Files:
    - `frontend/meeting-room.html` — main meeting UI, media capture, RTCPeerConnections, signalling handlers (offer/answer/ice), tile management, screen-share handling.
    - `backend/server.js` — Socket.IO server setup, room event handlers.
    - `backend/routes/meetings.js` — meeting API endpoints used to verify/join meetings and waiting-room endpoints.
  - How it works:
    - Client captures local media with `navigator.mediaDevices.getUserMedia()` and attaches stream to `#localVideo`.
    - Signalling messages (join-room, room-users, user-joined, offer, answer, ice-candidate) are exchanged over Socket.IO.
    - Each participant has a per-peer RTCPeerConnection created in `createPeerConnection()` inside `frontend/meeting-room.html`.

- Waiting Room & Admission
  - Files:
    - `frontend/meeting-room.html` — UI overlays and polling (`pollForAdmission`, `showWaitingRoomOverlay`).
    - `backend/routes/meetings.js` — endpoints: `/waiting-room`, `/waiting-room/admit`, `/waiting-room/admit-all`, `/waiting-room/reject`, `/waiting-room-status`.
  - How it works:
    - Students joining protected meetings may be placed in waiting-room; teachers see the waiting list and call admit endpoints to allow joiners.

- Meeting capacity (Max 50 students)
  - Files:
    - `backend/routes/meetings.js` — checks `MAX_STUDENTS_PER_MEETING` when admitting or joining and returns errors if exceeded.
  - How it works:
    - Before admit/join, backend counts active student participants and prevents admission if count >= 50.

- Auto-end after 2 hours + 10-minute warning
  - Files:
    - `backend/server.js` — monitor added that periodically checks meeting durations and emits socket events `meeting-ending-warning` and `meeting-auto-ended` to rooms.
    - `frontend/meeting-room.html` — listens for `meeting-ending-warning` and `meeting-auto-ended` and displays alerts/toasts and performs cleanup / redirect.
  - How it works:
    - Server calculates elapsed time since meeting start; when 10 minutes remain it emits a warning event; at 2 hours it ends meeting state server-side and emits auto-end which clients use to redirect and save analytics.

- Multi-teacher assignment (student selects teacher(s) at registration)
  - Files:
    - `frontend/login.html` — registration form updated to fetch teacher list and send `teacherIds` array.
    - `backend/routes/auth.js` — register route accepts `teacherIds` and `GET /api/auth/teachers` endpoint added to list teachers.
    - `backend/models/User.js` — user schema includes `assignedTeacherIds` array (and legacy `assignedTeacherId`).
  - How it works:
    - Student registration stores an array of teacher IDs; API endpoints filter upcoming meetings for students based on these assignments.

- Analytics (focus, durations now include seconds)
  - Files:
    - `frontend/meeting-room.html` — collects behavioral metrics: `behavioralData.study_duration_seconds`, `idle_time_seconds`, `tab_switch_count`, etc., and sends them to backend when session ends.
    - `backend/routes/analytics.js` — receives analytics, persists to DB and calls ML service where applicable.
    - `frontend/student-analytics.html`, `frontend/teacher-analytics.html` — display durations formatted as `hh:mm:ss` with fallbacks for older records.
  - How it works:
    - Frontend tracks seconds counters and posts them to analytics endpoint after meeting end; analytics pages format durations into `hh:mm:ss` for display.

- Recurrence and reminder system (removed)
  - Files:
    - `frontend/*` dashboards: recurrence UI removed from `frontend/teacher-dashboard.html` and registration UI adjusted.
    - `backend/routes/meetings.js` — recurrence/repeat creation paths removed.
    - `backend/server.js` — previously ran a reminder scheduler; scheduler startup was removed and reminder dispatch disabled.
  - Rationale:
    - Feature removed per requirements; reminders and recurring meetings are not active in this codebase.

- Notifications removed (browser popups and backend scheduler)
  - Files:
    - `frontend/student-dashboard.html`, `frontend/teacher-dashboard.html` — browser Notification scheduling code removed.
    - `backend/server.js` — scheduler for sending reminders removed/disabled.

- Screen sharing with teacher approval
  - Files:
    - `frontend/meeting-room.html` — `request-screen-share`, `screen-share-request-response`, permission flow, `toggleScreenShare`, and `getDisplayMedia` usage.
    - `backend/server.js` — socket events for requesting and approving screen-share requests.
  - How it works:
    - Students request permission; teachers approve via a modal; on approval the student can call `getDisplayMedia()` to start sharing and the system notifies other participants.

- WebRTC multi-camera / multi-participant stability fix
  - Files:
    - `frontend/meeting-room.html` — the offer/answer handling and the `room-users` flow were updated so only the joining client creates offers. The `socket.on('room-users', ...)` flow now has the joining client create offers to existing users; incoming `user-joined` simply adds tile placeholders.
  - Why this fixed the issue:
    - Previously both sides sometimes created offers (offer-glare). Ensuring only the joiner issues offers avoids simultaneous-offer collisions and stabilizes multiple video tiles.

---

## 4. Platform compatibility & limits

- Browsers supported: Modern Chromium-based browsers (Chrome, Edge), and Firefox. Key APIs used: `navigator.mediaDevices.getUserMedia`, `navigator.mediaDevices.getDisplayMedia`, `RTCPeerConnection` (WebRTC), `WebSocket`/Socket.IO. Mobile browsers may have limited feature parity (screen share, multiple streams).
- Video/audio: per-participant mesh of RTCPeerConnections — works for small groups; server is a signalling server only (no SFU).
- Hard limits implemented:
  - Max simultaneous students per meeting: 50 (enforced on backend) — see `backend/routes/meetings.js` where `MAX_STUDENTS_PER_MEETING` is applied.
  - Meeting maximum runtime: 2 hours (auto-end) with a 10-minute warning (server monitor in `backend/server.js`).
- Recommended practical limits:
  - Because the system uses a mesh architecture, the number of video streams each participant must send/receive scales with participants: expect performance degradation (CPU/bandwidth) before the 50 limit on typical client machines. For stable large-class performance, an SFU (media server) is recommended.

---

## 5. Developer / operator notes (run / test / restart)

- Restart backend to enable server monitor and capacity enforcement:

  In project root run:

  ```bash
  cd backend
  npm install
  node server.js
  ```

- Test checklist for viva demo:
  1. Start backend server.
  2. Open `frontend/login.html` in Chrome (serve via `http://localhost` or open file if allowed). Login as teacher and start a meeting (or use a created meetingId).
  3. On a second browser or device, open `frontend/meeting-room.html?meetingId=...` as a student to join and verify camera appears.
  4. Verify waiting-room admit flow for student when meeting configured that way.
  5. Verify screen-share request flow: student requests, teacher approves, student starts sharing.
  6. Observe analytics: after leaving meeting, open `frontend/student-analytics.html?meetingId=...` and `frontend/teacher-analytics.html?meetingId=...` to view `hh:mm:ss` formatted durations.

---

## 6. Key files quick map

- Backend
  - `backend/server.js` — app entry, Socket.IO setup, meeting monitor (auto-end/warning)
  - `backend/routes/meetings.js` — join, upcoming, waiting-room, admit endpoints, capacity checks
  - `backend/routes/auth.js` — register/login and `GET /api/auth/teachers`
  - `backend/routes/analytics.js` — analytics ingestion and ML integration
  - `backend/models/User.js` — user schema (includes `assignedTeacherIds`)

- Frontend
  - `frontend/meeting-room.html` — meeting UI, WebRTC signalling, camera/screen share, analytics collection
  - `frontend/student-analytics.html` — student analytics view, formats seconds to `hh:mm:ss`
  - `frontend/teacher-analytics.html` — teacher view
  - `frontend/login.html` — registration with teacher multi-select
  - `frontend/student-dashboard.html`, `frontend/teacher-dashboard.html` — dashboards (notifications and recurrence removed)

---

## 7. Known limitations & recommendations

- Mesh WebRTC scales poorly for large participant counts — consider moving to an SFU (Jitsi, Janus, mediasoup) for classes above ~10–15 with full video.
- Browser/device permissions: if camera shows a black screen, check OS/browser camera selection and whether another app (Teams/Zoom) is using the device. The code in `frontend/meeting-room.html` properly sets `srcObject` and calls `play()`.
- Database cleanup: recurring meeting fields remain in DB schema in some documents — if you remove recurrence feature permanently, run a DB migration to remove legacy fields.

---

If you want, I can:
- Add line-level references to the most important functions (e.g., `createPeerConnection()` in `frontend/meeting-room.html`) for quick navigation in viva.
- Generate a shorter slide-friendly one-page handout.

Good luck with your viva — tell me if you want the slide handout or specific line/quote references.
