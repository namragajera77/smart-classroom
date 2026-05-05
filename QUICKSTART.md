# 🚀 Quick Start Guide

## First Time Setup (5 Minutes)

### 1. Install Dependencies
```powershell
# In project root
npm install

# Setup Python ML service
cd ml-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 2. Configure Environment
```powershell
# Create .env file
copy .env.example .env

# Open and edit (use Notepad)
notepad .env
```

**Set these values in `.env`:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_classroom
JWT_SECRET=my_secret_key_123
ML_SERVICE_URL=http://localhost:5001

# SMTP reminders (required for real email delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=Smart Classroom <your_email@gmail.com>
SMTP_REQUIRE_TLS=true
```

For Gmail, create an App Password and use it as `SMTP_PASS`.

### 3. Start MongoDB
Ensure MongoDB is running on your system.

---

## Running the Application (3 Terminals)

### Terminal 1: Backend
```powershell
npm start
```
✅ Should see: "Server running on port 5000"

### Terminal 2: ML Service
```powershell
cd ml-service
venv\Scripts\activate
python app.py
```
✅ Should see: "Running on http://0.0.0.0:5001"

### Terminal 3: Frontend
```powershell
# Option 1: Open directly in browser
start frontend/login.html

# Option 2: Use local server
cd frontend
python -m http.server 8080
# Then open http://localhost:8080/login.html
```

---

## Quick Test Flow

### Create Teacher Account
1. Open login page
2. Click "Register here"
3. Fill details:
   - Name: `Teacher One`
   - Email: `teacher@test.com`
   - Password: `teacher123`
   - Role: **Teacher**
4. Click Register
5. You'll be redirected to Teacher Dashboard

### Create a Meeting
1. Enter meeting title: `Test Meeting`
2. Click "Create Meeting"
3. Copy the **Meeting ID** (e.g., MTG-1234567890-ABC123)
4. Click "Start Meeting"
5. Click "Join Room"

### Create Student Account (New Browser/Incognito)
1. Open login page in new browser tab
2. Register as student:
   - Name: `Student One`
   - Email: `student@test.com`
   - Password: `student123`
   - Role: **Student**
3. Enter the Meeting ID from teacher
4. Click "Join"

### Test Features
- ✅ Enable/disable camera and mic
- ✅ Send chat messages
- ✅ See both video streams
- ✅ (Student) Click "End Session & View Analytics"
- ✅ View Focus Heatmap
- ✅ (Teacher) End meeting and view class analytics

---

## Troubleshooting

### Backend won't start
```powershell
# Check if MongoDB is running
mongo

# If not running, start MongoDB service
net start MongoDB
```

### ML Service errors
```powershell
# Reinstall dependencies
cd ml-service
pip install -r requirements.txt --force-reinstall
```

### Camera/Mic not working
**For Chrome/Edge:**
1. Click the lock/info icon in address bar
2. Select "Allow" for Camera and Microphone
3. Reload the page

**For Brave:**
1. Click the Brave Shields icon (lion)
2. Advanced Controls → Allow Camera/Microphone
3. Reload the page

**For Firefox:**
1. Click the camera icon in address bar
2. Select "Allow" for Camera and Microphone
3. Reload the page

**If still not working:**
- Check browser permissions (Settings > Privacy > Camera/Microphone)
- Make sure no other app is using the camera
- Use HTTPS or localhost (WebRTC requirement)
- Try Chrome or Firefox
- Click OK when prompted to join in audio-only or listen-only mode

### CORS errors
- Ensure backend is running on port 5000
- Check `API_URL` in frontend files matches your backend URL

---

## API Health Checks

### Backend
```powershell
curl http://localhost:5000/health
```
Should return: `{"status":"ok"}`

### ML Service
```powershell
curl http://localhost:5001/health
```
Should return: `{"status":"ok","model_loaded":true}`

---

## Demo Credentials

**Teacher:**
- Email: `teacher@test.com`
- Password: `teacher123`

**Student:**
- Email: `student@test.com`
- Password: `student123`

**Session Info:**
- ✅ Tokens expire after 1 hour
- ✅ Users must login again after expiry
- ✅ Automatic logout on expired session

---

## Project Structure Overview

```
mini-project/
├── backend/          # Node.js + Express server
├── frontend/         # HTML/CSS/JS files
├── ml-service/       # Python Flask ML API
├── package.json      # Node dependencies
└── README.md         # Full documentation
```

---

## Next Steps

1. ✅ Complete quick test flow
2. 📖 Read full [README.md](README.md) for details
3. 🎯 Prepare for viva using Q&A section
4. 🚀 Customize and enhance features

---

## Support

- Check console logs in all 3 terminals
- Read error messages carefully
- All code is well-commented
- Refer to README.md for detailed explanations

---

**Ready for your viva! 🎓**
