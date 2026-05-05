"""
ML Service - Random Forest Predictor
Predicts student behavioral analytics based on behavioral data
IMPORTANT: No video/audio analysis - only behavioral data

"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

app = Flask(__name__)
CORS(app)

# Load or create ML model
MODEL_PATH = 'model.pkl'

def create_trained_model():
    """
    Train Random Forest model with large realistic dataset
    Uses 1000 samples for high accuracy
    """
    
    print("\n🔄 Training model with large dataset...")
    
    # Check if training data exists
    if not os.path.exists('training_data.csv'):
        print("⚠️  training_data.csv not found. Generating dataset...")
        import subprocess
        subprocess.run(['python', 'generate_dataset.py'])
    
    # Load training data
    try:
        df = pd.read_csv('training_data.csv')
        print(f"✅ Loaded {len(df)} training samples")
    except FileNotFoundError:
        print("❌ Could not load training data. Using fallback mock data.")
        return create_fallback_model()
    
    # Separate features and labels
    X = df[['study_duration', 'idle_time', 'break_count', 'tab_switch_count']].values
    y = df['attention_level'].values
    
    # Split into train and test sets (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Train Random Forest model
    model = RandomForestClassifier(
        n_estimators=200,  # More trees for better accuracy
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1  # Use all CPU cores
    )
    
    print("🧠 Training Random Forest...")
    model.fit(X_train, y_train)
    
    # Evaluate model
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\n✅ Model Training Complete!")
    print(f"📊 Training samples: {len(X_train)}")
    print(f"📊 Test samples: {len(X_test)}")
    print(f"🎯 Accuracy: {accuracy * 100:.2f}%")
    print(f"\n📈 Classification Report:")
    print(classification_report(y_test, y_pred, 
                                target_names=['Distracted', 'Moderate', 'Focused']))
    
    # Save trained model
    joblib.dump(model, MODEL_PATH)
    print(f"💾 Model saved to {MODEL_PATH}\n")
    
    return model

def create_fallback_model():
    """
    Fallback model with small dataset if CSV not available
    """
    print("⚠️  Using fallback model with limited data")
    
    X_train = np.array([
        [60, 5, 2, 3], [45, 10, 3, 8], [30, 20, 5, 15], [50, 7, 2, 5],
        [25, 25, 6, 20], [55, 8, 3, 4], [40, 15, 4, 12], [65, 3, 1, 2]
    ])
    y_train = np.array([2, 1, 0, 2, 0, 2, 1, 2])
    
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    joblib.dump(model, MODEL_PATH)
    
    return model

# Load or create model
if os.path.exists(MODEL_PATH):
    model = joblib.load(MODEL_PATH)
    print("✅ Model loaded from disk")
    print("ℹ️  To retrain with fresh data, delete model.pkl and restart")
else:
    model = create_trained_model()
    print("✅ New model trained and saved")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'ML Service is running',
        'model_loaded': model is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict student analytics based on behavioral data
    
    Input (JSON):
    {
        "behavioralData": {
            "study_duration": 45,
            "idle_time": 10,
            "break_count": 3,
            "tab_switch_count": 8
        }
    }
    
    Output (JSON):
    {
        "attention_status": "focused" | "moderate" | "distracted",
        "confidence": 0.85,
        "engagement_score": 75,
        "cognitive_load": "optimal" | "high" | "low",
        "suggestion": "personalized recommendation"
    }
    """
    try:
        data = request.get_json()
        behavioral_data = data.get('behavioralData', {})
        
        # Extract features
        study_duration = behavioral_data.get('study_duration', 0)
        idle_time = behavioral_data.get('idle_time', 0)
        break_count = behavioral_data.get('break_count', 0)
        tab_switch_count = behavioral_data.get('tab_switch_count', 0)
        
        # Prepare input for model
        features = np.array([[study_duration, idle_time, break_count, tab_switch_count]])
        
        # Make prediction
        prediction = model.predict(features)[0]
        probabilities = model.predict_proba(features)[0]
        confidence = float(max(probabilities))
        
        # Map prediction to attention status
        attention_map = {
            0: 'distracted',
            1: 'moderate',
            2: 'focused'
        }
        attention_status = attention_map.get(prediction, 'unknown')
        
        # Calculate engagement score (0-100)
        engagement_score = calculate_engagement_score(behavioral_data)
        
        # Determine cognitive load
        cognitive_load = determine_cognitive_load(behavioral_data)
        
        # Generate personalized suggestion
        suggestion = generate_suggestion(attention_status, behavioral_data)
        
        return jsonify({
            'attention_status': attention_status,
            'confidence': round(confidence, 2),
            'engagement_score': engagement_score,
            'cognitive_load': cognitive_load,
            'suggestion': suggestion
        })
        
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        return jsonify({
            'error': 'Prediction failed',
            'message': str(e)
        }), 500

def calculate_engagement_score(behavioral_data):
    """
    Calculate engagement score (0-100) based on behavioral data
    """
    study_duration = behavioral_data.get('study_duration', 0)
    idle_time = behavioral_data.get('idle_time', 0)
    tab_switch_count = behavioral_data.get('tab_switch_count', 0)
    
    # Base score
    score = 100
    
    # Penalize idle time
    if study_duration > 0:
        idle_ratio = idle_time / study_duration
        score -= idle_ratio * 30
    
    # Penalize excessive tab switches
    if study_duration > 0:
        tab_switch_ratio = tab_switch_count / study_duration
        score -= tab_switch_ratio * 20
    
    # Bonus for longer study duration
    if study_duration > 45:
        score += 10
    
    # Clamp between 0 and 100
    score = max(0, min(100, score))
    
    return int(score)

def determine_cognitive_load(behavioral_data):
    """
    Determine cognitive load level
    """
    break_count = behavioral_data.get('break_count', 0)
    study_duration = behavioral_data.get('study_duration', 0)
    
    if study_duration == 0:
        return 'unknown'
    
    break_ratio = break_count / (study_duration / 10)  # Breaks per 10 minutes
    
    if break_ratio > 2:
        return 'high'
    elif break_ratio > 1:
        return 'optimal'
    else:
        return 'low'

def generate_suggestion(attention_status, behavioral_data):
    """
    Generate personalized improvement suggestion
    """
    suggestions = {
        'focused': [
            'Excellent focus! Keep up the great work.',
            'You\'re doing great! Maintain this level of concentration.',
            'Outstanding engagement! Continue with your current study habits.'
        ],
        'moderate': [
            'Good effort! Try to minimize distractions for better focus.',
            'You\'re on the right track. Consider taking structured breaks.',
            'Reduce tab switching to improve concentration.'
        ],
        'distracted': [
            'Try the Pomodoro technique: 25 min focus + 5 min break.',
            'Minimize distractions by closing unnecessary tabs.',
            'Consider using website blockers during study sessions.',
            'Take regular breaks to avoid burnout and improve focus.'
        ]
    }
    
    # Add specific suggestions based on behavioral data
    idle_time = behavioral_data.get('idle_time', 0)
    tab_switch_count = behavioral_data.get('tab_switch_count', 0)
    
    suggestion_list = suggestions.get(attention_status, suggestions['moderate'])
    suggestion = suggestion_list[0]
    
    if idle_time > 15:
        suggestion = 'Reduce idle time by staying actively engaged with the material.'
    elif tab_switch_count > 10:
        suggestion = 'Too many tab switches detected. Try to stay focused on one task at a time.'
    
    return suggestion

@app.route('/train', methods=['POST'])
def train_model():
    """
    Endpoint to retrain model with new data (for future enhancement)
    """
    return jsonify({
        'message': 'Training endpoint - to be implemented with real data collection'
    })

if __name__ == '__main__':
    print("🤖 Starting ML Service...")
    print("📊 Random Forest Model Ready")
    print("🚫 No video/audio analysis - only behavioral data")
    app.run(host='0.0.0.0', port=5001, debug=True)
