# 🎅 Santa's ML Arena

An interactive, AI-powered Christmas experience with **ACCURATE** real-time pose detection! Built for Google Developer Groups (GDG) events.

## ✨ Features

- 🎄 **Premium Christmas Hero** - Beautiful animated SVG Santa scene with sunset & reindeer
- 🎮 **Accurate Pose Detection** - Geometric body validation with TensorFlow.js (actually works!)
- 🎯 **23 Pose Challenges** - Fast paced pose gauntlet
- ⚡ **Fast Loading** - Optimized TensorFlow model (1-2 second load time)
- 📊 **Smart Scoring** - Real accuracy calculation based on body geometry, not just confidence
- 🏆 **Live Leaderboard** - Real player names and scores with localStorage
- 📱 **Optimized Performance** - 60fps smooth animations, responsive design
- ⏱️ **Per-Pose Timer** - 30 seconds per pose (timeout skips, 0 points)
- ✅ **Hold Timer System** - Must hold pose at 80%+ accuracy for 2 seconds

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
http://localhost:3000
```

## 🎮 How to Play

1. **Enter Your Name** - Type your name on the welcome screen
2. **Allow Camera Access** - Grant permission when prompted
3. **Wait for Countdown** - Get ready (3-2-1-GO!)
4. **Perform Poses** - Complete all pose challenges (23 total)
5. **Earn Points** - Get 10 points per pose (accuracy ≥80%)
6. **View Score** - See your final score and check the leaderboard!

## 📊 Scoring System

- **Per Pose**: 10 points (when accuracy reaches 80%+ AND held for 2 seconds)
- **Time Limit**: 30 seconds per pose (timeout = 0 points)
- **Maximum Score**: 230 points (23 poses × 10 points)
- **Accuracy Display**: Real-time percentage (0-100%) based on body geometry
- **Hold Timer**: Visual countdown when accuracy ≥80%
- **Challenge Progression**: Automatic after successfully holding pose

### How Accuracy Works (NEW!)
- **Santa Pose**: Validates arm extension (wrists must be 1.5x wider than shoulders)
- **Elf Hop**: Validates knee bend (measures hip-to-knee distance)
- **Reindeer Stance**: Validates hands up (wrists must be above head)

**No more fake accuracy!** The system now measures actual body positions and angles.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React 18 with TypeScript
- **Animations**: Framer Motion
- **Styling**: Tailwind CSS
- **ML**: TensorFlow.js + MoveNet Pose Detection
- **Storage**: Browser localStorage (no database required)

## 📁 Project Structure

```
f:\GDG STALL\
├── app/
│   ├── page.tsx                # Home page with hero
│   ├── layout.tsx              # Root layout
│   ├── globals.css             # Global styles
│   ├── arena/
│   │   └── page.tsx            # Pose detection game
│   └── leaderboard/
│       └── page.tsx            # Rankings display
├── components/
│   ├── Hero.tsx                # Hero section
│   └── Snowfall.tsx            # Snow animation
├── public/                     # Static assets
├── package.json                # Dependencies
└── README.md                   # This file
```

## 🎨 Color Palette

```css
--festive-blue: #1a237e      /* Deep navy blue */
--festive-red: #c62828       /* Christmas red */
--festive-gold: #ffd700      /* Golden yellow */
--snow-white: #f8f9ff        /* Pure white */
```

## 📱 Browser Requirements

- Modern browser (Chrome, Firefox, Safari, Edge)
- Camera access enabled
- JavaScript enabled
- Good lighting for best pose detection

## 🎯 Game Tips

1. **Stand back** from the camera (full body visible)
2. **Good lighting** helps accuracy
3. **Hold poses steady** for 2 seconds
4. **Follow instructions** on each challenge
5. **Have fun!** 🎉

## 🔧 Configuration

### Adjust Difficulty

Edit `app/arena/page.tsx`:

```tsx
// Line ~90: Change accuracy threshold
if (currentAccuracy >= 80) { // Change to 70 for easier, 90 for harder
  setScore((prev) => prev + 10);
}
```

### Modify Points

```tsx
// Change point value per pose
setScore((prev) => prev + 10); // Change 10 to any value
```

### Add More Challenges

```tsx
const challenges = [
  // Add new challenge
  {
    name: 'Your Pose',
    description: 'Description here',
    icon: '🎄',
    targetKeypoints: ['left_wrist', 'right_wrist'],
  },
];
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm run build
vercel
```

### HTTPS Required

⚠️ **Important**: Camera access requires HTTPS in production. Vercel provides this automatically.

## 📊 Data Storage

- **Leaderboard**: Stored in browser `localStorage`
- **Player Names**: Stored with each score entry
- **No Backend**: Fully client-side (no database needed)
- **Data Persists**: Until browser cache is cleared

### localStorage Structure

```json
{
  "leaderboard": [
    {
      "name": "Player Name",
      "score": 30,
      "accuracy": 95,
      "timestamp": "2025-12-17T10:30:00Z"
    }
  ],
  "lastPlayerName": "Most Recent Player"
}
```

## 🐛 Troubleshooting

### Camera Not Working
- Check browser permissions
- Use HTTPS (required for camera access)
- Try a different browser
- Ensure good lighting

### Pose Not Detected
- Stand further back from camera
- Ensure full body is visible
- Improve lighting conditions
- Check if model is loaded (wait 3-5 seconds)

### Low Accuracy
- Hold poses steady
- Face the camera directly
- Improve lighting
- Move to plain background

## 🎄 Credits

Built with ❤️ for Google Developer Groups

- **Framework**: [Next.js](https://nextjs.org)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **ML**: [TensorFlow.js](https://www.tensorflow.org/js)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)

## 📄 License

MIT License - Free to use for GDG events and educational purposes!

---

<div align="center">

**🎅 Ready to play? Start the dev server and enter the arena! 🎄**

</div>
