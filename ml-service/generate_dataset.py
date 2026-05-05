"""
Generate Large Training Dataset for Behavioral Analytics
Creates 1000 realistic student behavior samples
"""

import numpy as np
import pandas as pd

def generate_realistic_dataset(n_samples=1000):
    """
    Generate realistic behavioral data for students
    
    Features:
    - study_duration: Time spent in meeting (minutes)
    - idle_time: Inactive time (minutes)
    - break_count: Number of breaks taken
    - tab_switch_count: Number of tab switches
    
    Labels:
    - 0: distracted
    - 1: moderate
    - 2: focused
    """
    
    np.random.seed(42)
    data = []
    
    # Generate FOCUSED students (40% of data)
    for _ in range(int(n_samples * 0.4)):
        study_duration = np.random.randint(50, 90)  # Long study time
        idle_time = np.random.randint(0, 10)  # Low idle time
        break_count = np.random.randint(1, 4)  # Few breaks
        tab_switch_count = np.random.randint(0, 5)  # Minimal tab switches
        
        data.append([study_duration, idle_time, break_count, tab_switch_count, 2])
    
    # Generate MODERATE students (35% of data)
    for _ in range(int(n_samples * 0.35)):
        study_duration = np.random.randint(35, 60)  # Medium study time
        idle_time = np.random.randint(8, 18)  # Medium idle time
        break_count = np.random.randint(3, 6)  # Moderate breaks
        tab_switch_count = np.random.randint(5, 12)  # Some tab switches
        
        data.append([study_duration, idle_time, break_count, tab_switch_count, 1])
    
    # Generate DISTRACTED students (25% of data)
    for _ in range(int(n_samples * 0.25)):
        study_duration = np.random.randint(15, 40)  # Short study time
        idle_time = np.random.randint(15, 35)  # High idle time
        break_count = np.random.randint(5, 10)  # Many breaks
        tab_switch_count = np.random.randint(10, 25)  # Lots of tab switches
        
        data.append([study_duration, idle_time, break_count, tab_switch_count, 0])
    
    # Convert to DataFrame
    df = pd.DataFrame(data, columns=[
        'study_duration', 'idle_time', 'break_count', 'tab_switch_count', 'attention_level'
    ])
    
    # Shuffle the data
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    return df

if __name__ == '__main__':
    print("🔄 Generating training dataset...")
    
    # Generate 1000 samples
    dataset = generate_realistic_dataset(n_samples=1000)
    
    # Save to CSV
    dataset.to_csv('training_data.csv', index=False)
    
    print(f"✅ Dataset generated: {len(dataset)} samples")
    print(f"\n📊 Class Distribution:")
    print(f"   Focused (2): {len(dataset[dataset['attention_level'] == 2])} samples")
    print(f"   Moderate (1): {len(dataset[dataset['attention_level'] == 1])} samples")
    print(f"   Distracted (0): {len(dataset[dataset['attention_level'] == 0])} samples")
    
    print(f"\n📈 Sample Statistics:")
    print(dataset.describe())
    
    print("\n💾 Saved to: training_data.csv")
