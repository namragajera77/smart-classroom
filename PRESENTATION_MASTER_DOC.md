# Smart Online Classroom and Meeting Platform

## 1. Project Title
Smart Online Classroom and Meeting Platform with Behavioral Analytics

## 2. Problem Statement
Online classes usually focus only on communication, but teachers still struggle to understand student engagement and focus levels during sessions. Many analytics tools are invasive and use camera or audio analysis, which creates privacy concerns.

This project solves that gap by combining:
- secure online meeting functionality,
- role-based access control,
- privacy-first behavioral analytics,
- machine learning based engagement insights.

## 3. Project Objective
- Build a full-stack online classroom platform for teachers and students.
- Provide secure login and role-based permissions.
- Support real-time video, audio, and chat.
- Track non-invasive behavioral metrics.
- Predict attention and engagement using ML.
- Visualize focus patterns through a heatmap timeline.

## 4. Core Features Implemented

### 4.1 Authentication and Security
- JWT-based login and session handling.
- Password hashing using bcryptjs.
- Protected APIs with middleware authentication.
- Role-Based Access Control (RBAC): Teacher and Student roles.

### 4.2 Role-Based Access Control (RBAC)
Teacher can:
- Create meetings.
- Start and end meetings.
- View participant list.
- View class-level analytics.

Student can:
- Join meetings using meeting ID.
- Participate in video/audio/chat.
- View only personal analytics.

### 4.3 Meeting and Real-Time Communication
- Meeting creation and join flow.
- WebRTC peer-to-peer video and audio.
- Camera on/off and microphone mute/unmute.
- Socket.IO signaling for WebRTC.
- Real-time classroom chat.
- Participant join/leave tracking.

### 4.4 Behavioral Analytics (Privacy-First)
Tracked metrics:
- Study duration.
- Idle time.
- Break count.
- Tab switch count.

Privacy policy in implementation:
- No face detection.
- No emotion recognition.
- No video or audio analysis.
- No recording of media streams.

### 4.5 Machine Learning Integration
- Python Flask service with Random Forest model.
- Input features: study duration, idle time, breaks, tab switches.
- Output predictions:
  - attention status (focused/moderate/distracted),
  - engagement score (0-100),
  - cognitive load,
  - confidence,
  - personalized suggestions.

### 4.6 Unique Innovation: Focus Heatmap Timeline
- Color-coded timeline to show focus level over the session.
- Student view: personal focus pattern.
- Teacher view: class-level comparison.
- Helps identify low-focus periods quickly.

## 5. System Architecture

### 5.1 High-Level Architecture
Frontend (HTML/CSS/JS + WebRTC) -> Backend (Node.js/Express + Socket.IO + MongoDB) -> ML Service (Flask + scikit-learn)

### 5.2 Modules
- Frontend module: login, dashboards, meeting room, analytics pages.
- Backend module: auth, meetings, analytics APIs; Socket.IO signaling.
- ML module: prediction API and model inference.
- Database module: Users, Meetings, Participants, Analytics collections.

## 6. Technology Stack

### 6.1 Frontend
- HTML5
- CSS3
- JavaScript (vanilla)
- WebRTC API
- Socket.IO client

### 6.2 Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- Socket.IO
- JWT (jsonwebtoken)
- bcryptjs
- dotenv
- cors
- axios

### 6.3 ML Service
- Python
- Flask
- Flask-CORS
- scikit-learn
- NumPy
- Pandas
- joblib

## 7. Important API Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login

### Meetings
- POST /api/meetings/create
- GET /api/meetings/my-meetings
- POST /api/meetings/start/:meetingId
- POST /api/meetings/end/:meetingId
- POST /api/meetings/join/:meetingId
- GET /api/meetings/participants/:id

### Analytics
- POST /api/analytics/submit
- GET /api/analytics/my-stats/:meetingId
- GET /api/analytics/class/:meetingId

### ML Service
- POST /predict
- GET /health

## 8. End-to-End Workflow

### Teacher Flow
1. Register/login as teacher.
2. Create meeting and share meeting ID.
3. Start meeting and conduct class.
4. End meeting.
5. View class analytics and heatmaps.

### Student Flow
1. Register/login as student.
2. Join meeting using meeting ID.
3. Attend class with video/audio/chat.
4. Behavioral data tracked automatically.
5. End session and view personal analytics.

## 9. Problems Faced and Solutions

### 9.1 Planning and Architecture
Problem:
- Choosing between multiple technologies for real-time communication and database design.

Solution:
- Selected Socket.IO for reliable signaling and MongoDB for flexible analytics schema.

### 9.2 Database and Backend Setup
Problem:
- MongoDB connection and firewall/whitelisting issues.

Solution:
- Fixed Atlas network access settings and improved connection error handling.

### 9.3 Authentication and RBAC
Problem:
- Handling token validation and role protection correctly across routes.

Solution:
- Implemented dedicated auth and RBAC middleware and tested role-based scenarios.

### 9.4 WebRTC Integration
Problem:
- STUN/NAT traversal complexity, multi-peer handling, and disconnections.

Solution:
- Added stable signaling flow using Socket.IO, ICE exchange handling, and reconnection-safe logic.

### 9.5 Frontend and UX
Problem:
- Keeping layout responsive and consistent across multiple pages and browsers.

Solution:
- Unified dashboard styles and tested responsive behavior for key resolutions.

### 9.6 Behavioral Tracking
Problem:
- Avoiding false idle detections and handling browser tab visibility edge cases.

Solution:
- Used activity listeners with threshold-based idle detection and refined tab-switch logic.

### 9.7 ML Model Development
Problem:
- Limited real dataset during development and balancing model interpretability.

Solution:
- Generated synthetic training data and used Random Forest for robust baseline predictions.

### 9.8 Data Visualization
Problem:
- Converting raw behavioral metrics into intuitive visual insights.

Solution:
- Built Focus Heatmap Timeline with clear color coding and readable dashboard summaries.

### 9.9 Testing and Cross-Browser Issues
Problem:
- WebRTC behavior differs across browsers, especially Safari limitations.

Solution:
- Performed cross-browser testing and documented known constraints and workarounds.

## 10. Testing and Quality Work
- End-to-end testing done for auth, meetings, analytics, and ML flow.
- Security checks on protected routes and token handling.
- Bug fixes for URI/config, video grid behavior, and idle tracking.
- Performance improvements in event handling and data loading.

## 11. Project Outcomes
- Delivered a working full-stack platform with real-time and ML components.
- Demonstrated secure RBAC architecture.
- Implemented privacy-safe analytics model.
- Added a unique visual feature (Focus Heatmap Timeline).
- Built presentation-ready educational software prototype.

## 12. Future Enhancements
- Screen sharing.
- Raise hand and reactions.
- Poll/quiz during class.
- Waiting room and teacher approval.
- Attendance export (PDF/CSV).
- Breakout rooms.
- Meeting recording with consent.

## 13. Presentation Script (Suggested)

### Slide 1: Introduction
- Present title, problem statement, and objective.

### Slide 2: System Overview
- Explain frontend-backend-ML architecture.

### Slide 3: Core Features
- Show authentication, meetings, chat, and analytics.

### Slide 4: Tech Stack
- Explain why each technology was selected.

### Slide 5: Unique Feature
- Demonstrate Focus Heatmap Timeline and insights.

### Slide 6: Challenges Faced
- Explain major technical problems and how they were solved.

### Slide 7: Results and Impact
- Show completed outcomes and value for education.

### Slide 8: Future Scope
- Present planned enhancements.

## 14. Key Viva One-Liners
- "Our system is privacy-first because it uses only behavioral metrics, not camera/audio analysis."
- "RBAC is enforced using JWT + middleware, so access is secure and role-specific."
- "WebRTC provides peer-to-peer communication, while Socket.IO handles signaling and real-time chat."
- "Random Forest predicts attention and engagement from non-invasive behavioral data."
- "Focus Heatmap Timeline is our unique visual feature for quick engagement interpretation."

## 15. Conclusion
This project successfully combines secure online teaching, real-time communication, and machine learning analytics into one platform. It addresses a real educational challenge and provides a practical, scalable base for future advanced classroom intelligence features.
