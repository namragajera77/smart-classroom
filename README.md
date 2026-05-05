# 🎓 Smart Online Classroom & Meeting Platform with Behavioral Analytics

A full-stack college mini project featuring **Role-Based Access Control (RBAC)**, **WebRTC video conferencing**, and **ML-powered behavioral analytics**.

## 🌟 Key Features

### Authentication & Authorization
- **JWT-based authentication** (email + password)
- **Role-Based Access Control (RBAC)** with two user roles:
  - 👨‍🏫 **Teacher**: Create meetings, view all analytics
  - 👨‍🎓 **Student**: Join meetings, view own analytics

### Meeting Features
- ✅ Live video & audio communication (WebRTC)
- ✅ Mute/unmute microphone
- ✅ Camera on/off toggle
- ✅ Real-time chat messaging
- ✅ Screen sharing support
- ✅ WebRTC signaling via Socket.IO

### Behavioral Analytics (Privacy-First)
- 📊 Track study duration, idle time, breaks, tab switches
- 🤖 ML predictions using Random Forest:
  - Attention status (focused/moderate/distracted)
  - Engagement score (0-100)
  - Cognitive load level
  - Personalized improvement suggestions
- 🔥 **Focus Heatmap Timeline** (unique feature)
  - Color-coded focus visualization over time
  - Students see their own heatmap
  - Teachers see class-level heatmap for all students

### Privacy Compliance
- ✅ **NO video/audio analysis** - used only for communication
- ✅ **NO face detection or emotion recognition**
- ✅ Analytics based solely on behavioral data
- ✅ Post-meeting analytics only

---

## 📁 Project Structure

```
mini-project/
├── backend/
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── models/
│   │   ├── User.js                  # User schema with RBAC
│   │   ├── Meeting.js               # Meeting schema
│   │   ├── Participant.js           # Participant tracking
│   │   └── Analytics.js             # Behavioral analytics
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication
│   │   └── rbac.js                  # Role-based authorization
│   ├── routes/
│   │   ├── auth.js                  # Login/Register
│   │   ├── meetings.js              # Meeting management
│   │   └── analytics.js             # Analytics endpoints
│   └── server.js                    # Main server + WebRTC signaling
├── frontend/
│   ├── login.html                   # Login/Register page
│   ├── teacher-dashboard.html       # Teacher dashboard
│   ├── student-dashboard.html       # Student dashboard
│   ├── meeting-room.html            # WebRTC meeting room
│   ├── teacher-analytics.html       # Class analytics + heatmap
│   └── student-analytics.html       # Personal analytics
├── ml-service/
│   ├── app.py                       # Flask ML service
│   ├── requirements.txt             # Python dependencies
│   └── model.pkl                    # Random Forest model (auto-generated)
├── package.json
├── .env.example
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Python 3.8+

### Step 1: Clone the Repository
```bash
cd c:\Users\PREMIUM\OneDrive\Desktop\mini-project
```

### Step 2: Backend Setup
```bash
# Install Node.js dependencies
npm install

# Create .env file
copy .env.example .env

# Edit .env with your configuration
notepad .env
```

**Example `.env` configuration:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_classroom
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
ML_SERVICE_URL=http://localhost:5001

# SMTP reminders (real email delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=Smart Classroom <your_email@gmail.com>
SMTP_REQUIRE_TLS=true
```

### Step 3: ML Service Setup
```bash
# Navigate to ML service directory
cd ml-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Step 4: Start MongoDB
```bash
# Make sure MongoDB is running
# Windows: MongoDB should be running as a service
# Linux: sudo systemctl start mongod
```

---

## ▶️ Running the Application

You need to run **3 services** simultaneously:

### Terminal 1: Backend Server
```bash
npm start
# or for development with auto-reload:
npm run dev
```
Server runs on: `http://localhost:5000`

### Terminal 2: ML Service
```bash
cd ml-service
venv\Scripts\activate  # Activate virtual environment
python app.py
```
ML service runs on: `http://localhost:5001`

### Terminal 3: Frontend
Open `frontend/login.html` in a web browser (Chrome/Firefox recommended)

Or use a local server:
```bash
# Using Python
cd frontend
python -m http.server 8080

# Or using Node.js http-server
npx http-server frontend -p 8080
```
Frontend runs on: `http://localhost:8080`

---

## 📖 User Guide

### For Teachers 👨‍🏫

#### 1. Register/Login
- Navigate to login page
- Register with role: **Teacher**
- Login with credentials

#### 2. Create Meeting
- Go to Teacher Dashboard
- Enter meeting title
- Click "Create Meeting"
- Share **Meeting ID** with students

#### 3. Start Meeting
- Click "Start Meeting" button
- Join the meeting room
- Students can now join using the Meeting ID

#### 4. During Meeting
- Enable/disable camera and mic
- Send chat messages
- View participant list
- End meeting when complete

#### 5. View Analytics
- After ending meeting, click "View Analytics"
- See class-level statistics:
  - Average engagement score
  - Focus drop alerts
  - Individual student performance
  - **Class Focus Heatmap Timeline** (all students)

### For Students 👨‍🎓

#### 1. Register/Login
- Navigate to login page
- Register with role: **Student**
- Login with credentials

#### 2. Join Meeting
- Go to Student Dashboard
- Enter **Meeting ID** provided by teacher
- Click "Join"

#### 3. During Meeting
- Enable/disable camera and mic
- Send chat messages
- Behavioral data is tracked automatically:
  - Study duration
  - Idle time
  - Tab switches
  - Breaks

#### 4. End Session & View Analytics
- Click "End Session & View Analytics"
- View personal analytics:
  - Attention status
  - Engagement score
  - Cognitive load
  - **Personal Focus Heatmap Timeline**
  - AI-powered improvement suggestions

---

## 🔐 Role-Based Access Control (RBAC)

### Student Permissions ✅
- Register / Login
- Join meetings with Meeting ID
- Enable/disable camera and mic
- Send chat messages
- View **own** meeting stats
- View **own** analytics and focus heatmap
- Receive personalized suggestions

### Student Restrictions ❌
- Cannot create meetings
- Cannot view other students' analytics
- Cannot access class-level analytics
- Cannot start/end meetings

### Teacher Permissions ✅
- Register / Login
- Create meetings
- Start / End meetings
- View participant list
- View attendance reports
- View **all students'** analytics
- View class-level focus heatmap
- Access engagement summaries

### Teacher Restrictions ❌
- Cannot join as regular participant without creating meeting
- Cannot modify student analytics data

---

## 🤖 ML Analytics Explained

### Input: Behavioral Data
```json
{
  "study_duration": 45,      // minutes in meeting
  "idle_time": 10,           // minutes inactive
  "break_count": 3,          // number of breaks
  "tab_switch_count": 8      // times switched tabs
}
```

### Output: ML Predictions
```json
{
  "attention_status": "focused",     // focused/moderate/distracted
  "confidence": 0.85,                // prediction confidence
  "engagement_score": 75,            // 0-100 score
  "cognitive_load": "optimal",       // low/optimal/high
  "suggestion": "Great focus! Keep it up!"
}
```

### Random Forest Model
- Trained on behavioral patterns
- Classifies attention levels
- Generates personalized suggestions
- No face detection or video analysis

---

## 🔥 Focus Heatmap Timeline (Unique Feature)

### What is it?
A color-coded visual representation of focus levels throughout the session.

### How it works:
1. Focus level (0-100) calculated from behavioral data
2. Timeline divided into intervals
3. Each interval color-coded:
   - 🟢 **Green (70-100)**: High Focus
   - 🟡 **Yellow (40-70)**: Moderate Focus
   - 🔴 **Red (0-40)**: Low Focus

### Student View:
- See personal focus heatmap
- Identify when focus drops occurred
- Understand engagement patterns

### Teacher View:
- See all students' heatmaps in one view
- Identify struggling students
- Detect class-wide focus drops
- Make data-driven teaching decisions

---

## 🛡️ Privacy & Data Handling

### ✅ What We DO:
- Track behavioral data (study time, tab switches, etc.)
- Analyze engagement patterns
- Generate personalized suggestions
- Store analytics in database

### ❌ What We DON'T:
- Analyze video frames
- Detect facial expressions
- Record audio/video
- Track personal browsing history
- Share data with third parties

---

## 🧪 API Endpoints

### Authentication
```
POST /api/auth/register    # Register new user
POST /api/auth/login       # Login user
```

### Meetings (Protected)
```
POST   /api/meetings/create              # Create meeting (Teacher)
GET    /api/meetings/my-meetings         # Get teacher's meetings
POST   /api/meetings/start/:meetingId    # Start meeting (Teacher)
POST   /api/meetings/end/:meetingId      # End meeting (Teacher)
POST   /api/meetings/join/:meetingId     # Join meeting (Both)
GET    /api/meetings/participants/:id    # Get participants (Teacher)
```

### Analytics (Protected)
```
POST /api/analytics/submit               # Submit data (Student)
GET  /api/analytics/my-stats/:meetingId  # Get own stats (Student)
GET  /api/analytics/class/:meetingId     # Get class stats (Teacher)
```

### ML Service
```
POST /predict    # Get ML predictions
GET  /health     # Health check
```

---

## 🔧 Tech Stack

### Backend
- **Node.js** + **Express.js** - Server framework
- **MongoDB** + **Mongoose** - Database
- **Socket.IO** - WebRTC signaling
- **JWT** - Authentication
- **bcryptjs** - Password hashing

### Frontend
- **HTML5** + **CSS3** + **JavaScript**
- **WebRTC API** - Video/Audio streaming
- **Socket.IO Client** - Real-time communication

### ML Service
- **Python** + **Flask** - ML API
- **Scikit-learn** - Random Forest model
- **NumPy** + **Pandas** - Data processing

---

## 📊 Database Schema

### Users Collection
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: "teacher" | "student",
  createdAt: Date
}
```

### Meetings Collection
```javascript
{
  meetingId: String (unique),
  title: String,
  teacherId: ObjectId,
  teacherName: String,
  status: "scheduled" | "active" | "ended",
  startTime: Date,
  endTime: Date
}
```

### Analytics Collection
```javascript
{
  userId: ObjectId,
  meetingId: String,
  userName: String,
  behavioralData: {
    study_duration: Number,
    idle_time: Number,
    break_count: Number,
    tab_switch_count: Number
  },
  predictions: {
    attention_status: String,
    confidence: Number,
    engagement_score: Number,
    cognitive_load: String,
    suggestion: String
  },
  focusTimeline: [{
    timestamp: Date,
    focusLevel: Number
  }]
}
```

---

## 🎯 Viva Questions & Answers

### Q1: Why no video/audio analysis?
**A:** Privacy is critical. Our system respects user privacy by analyzing only behavioral data (study time, tab switches) rather than invasive video/audio analysis.

### Q2: How does RBAC work?
**A:** We use JWT tokens with role information. Middleware functions (`authorizeTeacher`, `authorizeStudent`) check user roles before allowing access to protected routes.

### Q3: What makes the Focus Heatmap unique?
**A:** It provides real-time visual feedback on engagement patterns. Teachers can identify struggling students at a glance, and students can reflect on their focus patterns.

### Q4: How accurate is the ML model?
**A:** Our Random Forest model is trained on behavioral patterns. Accuracy improves with more training data. Current implementation uses mock data for demonstration.

### Q5: Can this scale to large classes?
**A:** Yes! MongoDB handles large datasets, and WebRTC mesh topology can be replaced with SFU (Selective Forwarding Unit) for better scalability in production.

---

## 🚧 Future Enhancements

1. **Screen sharing** implementation
2. **Recording** capabilities with privacy controls
3. **Breakout rooms** for group discussions
4. **Quiz integration** during meetings
5. **Advanced ML models** (LSTM for time-series)
6. **Mobile app** support
7. **Cloud deployment** (AWS/Azure)

---

## 🤝 Contributing

This is a college mini project. Feel free to fork and enhance!

---

## 📄 License

MIT License - Free to use for educational purposes

---

## 👨‍💻 Developer Notes

### Debugging Tips
- Check MongoDB connection: `mongo` command
- Test ML service: `curl http://localhost:5001/health`
- View logs: Check console output in all 3 terminals

### Common Issues
1. **CORS errors**: Ensure backend CORS is enabled
2. **Camera not working**: Check browser permissions
3. **ML predictions failing**: Ensure ML service is running

---

## 📞 Support

For questions or issues, refer to:
- Code comments (extensively documented)
- Console logs (enabled in development)
- API error messages

---

**Built with ❤️ for Computer Engineering Mini Project**

**Suitable for:** College projects, viva presentations, demonstrations

**Key Highlights for Viva:**
✅ RBAC implementation  
✅ WebRTC real-time communication  
✅ ML-powered analytics  
✅ Privacy-first approach  
✅ Clean, commented code  
✅ Unique Focus Heatmap feature
