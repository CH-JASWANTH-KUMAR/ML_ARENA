# Gemini AI Integration for Pose Detection

## Setup Instructions

### 1. Get Your Gemini API Key
1. Visit https://aistudio.google.com/app/apikey
2. Create a new API key
3. Copy the API key

### 2. Update Environment Variable
Open `.env.local` and replace `your_gemini_api_key_here` with your actual API key:
```
NEXT_PUBLIC_GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Key Changes Made

The application now uses:
- **MoveNet** for real-time pose detection (skeleton overlay)
- **Gemini AI** for accuracy validation after 2 seconds of holding a pose

### 4. How It Works

1. MoveNet detects your pose in real-time and draws the skeleton
2. When you hold a pose steady for 2 seconds, the app captures a screenshot
3. The screenshot is sent to Gemini AI for accuracy analysis
4. Gemini returns a score from 0-100
5. Points are awarded based on Gemini's accuracy score:
   - 80-100%: 8-10 points
   - 60-79%: 6-7 points  
   - 40-59%: 4-5 points
   - 0-39%: 0-3 points

### 5. Simplified Challenges

The app now includes 10 core poses instead of 40+ to ensure better performance:
- T-Pose
- Hands Up
- Arms Wide (Santa)
- Hands on Hips
- Squat
- Star Pose
- Warrior
- Clap
- Balance (Left)
- High Knee (Left)

### 6. Testing

1. Run `npm run dev`
2. Navigate to http://localhost:3000/arena
3. Allow camera access
4. Try performing the poses!

### 7. Troubleshooting

**Error: "Gemini AI not initialized"**
- Make sure your API key is correctly set in `.env.local`
- Restart the development server after updating the environment file

**Accuracy always returns 0**
- Check browser console for Gemini API errors
- Verify your API key has the correct permissions
- Ensure you have internet connection for API calls

**Camera not working**
- Grant camera permissions when prompted
- Try refreshing the page
- Check if another application is using the camera

## Technical Details

### Screenshot Capture
When a pose is held for 2 seconds, the app:
1. Captures the current canvas frame as a JPEG image
2. Converts it to base64 format
3. Sends it to Gemini with the pose name and description

### Gemini Prompt
The AI receives:
```
You are a pose detection expert. Analyze this image and determine how accurately 
the person is performing the "[Pose Name]" pose.

Pose Description: [Description]

Please rate the accuracy from 0-100...
```

### Rate Limiting
- Gemini Free tier: 60 requests per minute
- Each pose validation = 1 request
- With 10 poses and 20 seconds per pose, you'll stay well within limits

## Future Enhancements

- Add more pose variations
- Implement pose difficulty levels
- Show Gemini's detailed feedback
- Cache results to reduce API calls
- Add offline mode with fallback validation
