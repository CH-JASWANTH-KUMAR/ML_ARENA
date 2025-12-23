# GDG Stall Website - Implementation Guide

## ✅ Already Fixed (from previous update)
- Timer set to **20 seconds** (was 30)
- Random visuals stabilized (no jitter)
- Alert() replaced with inline error messages  
- Link/button semantics fixed
- Font loading conflict resolved
- LocalStorage robustness improved

---

## 🎵 Background Music Setup

### Step 1: Add Music File
Save your Christmas background music as:
```
f:\GDG STALL\public\background-music.mp3
```

### Step 2: Code Changes in `app/arena/page.tsx`

**Add audio ref after other state:**
```typescript
const audioRef = useRef<HTMLAudioElement | null>(null);
```

**Initialize music in useEffect (around line 640):**
```typescript
// Initialize background music
if (typeof window !== 'undefined') {
  audioRef.current = new Audio('/background-music.mp3');
  audioRef.current.loop = true;
  audioRef.current.volume = 0.3;
}

return () => {
  mounted = false;
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;
  }
};
```

**Start music when game starts (in `startGame` function around line 665):**
```typescript
// Start background music
if (audioRef.current) {
  audioRef.current.play().catch(() => {
    // Ignore autoplay errors
  });
}
```

**Stop music in `finishGame` (around line 970):**
```typescript
// Stop background music
if (audioRef.current) {
  audioRef.current.pause();
  audioRef.current.currentTime = 0;
}
```

---

## 🎯 Accuracy-Based Scoring

### Change scoring logic (around line 900):

**Find this code:**
```typescript
if (!poseResolvedRef.current && holdSeconds >= POSE_HOLD_SECONDS) {
  poseResolvedRef.current = true;
  holdStartMsRef.current = null;
  clearPoseTimer();
  setScore(prev => {
    const next = prev + POINTS_PER_POSE;  // OLD
    scoreRef.current = next;
    return next;
  });
```

**Replace with:**
```typescript
if (!poseResolvedRef.current && holdSeconds >= POSE_HOLD_SECONDS) {
  poseResolvedRef.current = true;
  holdStartMsRef.current = null;
  clearPoseTimer();
  
  // Award points based on accuracy (80% = 8 points, 100% = 10 points)
  const earnedPoints = Math.floor(currentAccuracy / 10);
  setScore(prev => {
    const next = prev + earnedPoints;
    scoreRef.current = next;
    return next;
  });
```

---

## 📊 Cumulative Leaderboard for Returning Players

### Update `finishGame` function (around line 970):

**Find:**
```typescript
leaderboard.push(leaderboardData);
```

**Replace entire leaderboard update section with:**
```typescript
// Find existing player and accumulate scores
const existingPlayerIndex = leaderboard.findIndex(
  (entry) => entry.name.toLowerCase() === participantName.toLowerCase()
);

if (existingPlayerIndex !== -1) {
  // Update existing player score (accumulate)
  leaderboard[existingPlayerIndex].score += finalScore;
  leaderboard[existingPlayerIndex].accuracy = accuracyRef.current;
  leaderboard[existingPlayerIndex].timestamp = new Date().toISOString();
  leaderboard[existingPlayerIndex].attempts = (leaderboard[existingPlayerIndex].attempts || 1) + 1;
} else {
  // New player
  leaderboard.push({
    name: participantName,
    score: finalScore,
    accuracy: accuracyRef.current,
    timestamp: new Date().toISOString(),
    attempts: 1,
  });
}
```

---

## 🎭 15 New Poses to Add

Add these after the last existing pose (before `];`):

```typescript
  {
    name: 'Santa Salute',
    description: 'Right hand salute, left hand on hip',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const re = getKp(pose, 'right_ear');
      const lw = getKp(pose, 'left_wrist');
      const lh = getKp(pose, 'left_hip');
      if (!rw || !re || !lw || !lh) return 0;
      const s = shoulderScale(pose);
      const salute = clamp(1 - dist(rw, re) / (0.65 * s), 0, 1);
      const hipHand = clamp(1 - dist(lw, lh) / (0.85 * s), 0, 1);
      return score01To100(salute * 0.7 + hipHand * 0.3);
    },
  },
  {
    name: 'Reindeer Antlers',
    description: 'Both hands open above head like antlers',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!lw || !rw || !nose) return 0;
      const s = shoulderScale(pose);
      const wristsY = avgY(lw, rw);
      const up = clamp((nose.y - wristsY) / (0.7 * s), 0, 1);
      const apart = clamp(Math.abs(rw.x - lw.x) / (1.3 * s), 0, 1);
      return score01To100(up * 0.6 + apart * 0.4);
    },
  },
  {
    name: 'Candy Cane Squat',
    description: 'Slight squat + one arm straight up',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      const lh = getKp(pose, 'left_hip');
      const lk = getKp(pose, 'left_knee');
      const la = getKp(pose, 'left_ankle');
      const rh = getKp(pose, 'right_hip');
      const rk = getKp(pose, 'right_knee');
      const ra = getKp(pose, 'right_ankle');
      if (!rw || !nose || !lh || !lk || !la || !rh || !rk || !ra) return 0;
      const s = shoulderScale(pose);
      const armUp = clamp((nose.y - rw.y) / (0.65 * s), 0, 1);
      const a1 = angleDeg(lh, lk, la);
      const a2 = angleDeg(rh, rk, ra);
      const squat = clamp((165 - (a1 + a2) / 2) / (165 - 120), 0, 1);
      return score01To100(armUp * 0.5 + squat * 0.5);
    },
  },
  {
    name: 'Santa Belly',
    description: 'Both hands on stomach - push it out',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!lw || !rw || !ls || !rs || !lh || !rh) return 0;
      const stomachY = (avgY(ls, rs) + avgY(lh, rh)) / 2;
      const wristsY = avgY(lw, rw);
      const s = shoulderScale(pose);
      const onBelly = clamp(1 - Math.abs(wristsY - stomachY) / (0.45 * s), 0, 1);
      const together = clamp(1 - dist(lw, rw) / (0.7 * s), 0, 1);
      return score01To100(onBelly * 0.6 + together * 0.4);
    },
  },
  {
    name: 'Christmas Proposal',
    description: 'One knee down + both hands forward',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const lk = getKp(pose, 'left_knee');
      const rk = getKp(pose, 'right_knee');
      if (!lw || !rw || !lk || !rk) return 0;
      const s = shoulderScale(pose);
      const kneeDiff = Math.abs(lk.y - rk.y);
      const kneeDown = clamp(kneeDiff / (0.8 * s), 0, 1);
      const handsForward = clamp(dist(lw, rw) / (0.85 * s), 0, 1);
      return score01To100(kneeDown * 0.6 + handsForward * 0.4);
    },
  },
  {
    name: 'Ho-Ho-Hands Up',
    description: 'Both hands straight up - Say Ho Ho Ho!',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!lw || !rw || !nose) return 0;
      const s = shoulderScale(pose);
      const wristsY = avgY(lw, rw);
      const up = clamp((nose.y - wristsY) / (0.8 * s), 0, 1);
      return score01To100(up);
    },
  },
  {
    name: 'Snowball Throw',
    description: 'One hand behind head like throwing',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const re = getKp(pose, 'right_ear');
      const rs = getKp(pose, 'right_shoulder');
      if (!rw || !re || !rs) return 0;
      const s = shoulderScale(pose);
      const behindHead = clamp((rw.y - re.y) / (0.5 * s), 0, 1);
      const highEnough = clamp((rs.y - rw.y) / (0.4 * s), 0, 1);
      return score01To100(behindHead * 0.6 + highEnough * 0.4);
    },
  },
  {
    name: 'Christmas Dab',
    description: 'Classic dab - Santa Dab Challenge!',
    validate: (pose) => {
      const le = getKp(pose, 'left_elbow');
      const re = getKp(pose, 'right_elbow');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!le || !re || !lw || !rw || !nose) return 0;
      const s = shoulderScale(pose);
      const oneArmUp = Math.max(
        clamp((nose.y - lw.y) / (0.5 * s), 0, 1),
        clamp((nose.y - rw.y) / (0.5 * s), 0, 1)
      );
      const elbowsUp = clamp((avgY(le, re) - nose.y) / (0.3 * s) * -1, 0, 1);
      return score01To100(oneArmUp * 0.7 + elbowsUp * 0.3);
    },
  },
  {
    name: 'Elf Sneak Pose',
    description: 'Lean forward + finger on lips 🤫',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!rw || !nose || !ls || !rs || !lh || !rh) return 0;
      const s = shoulderScale(pose);
      const fingerNearFace = clamp(1 - dist(rw, nose) / (0.6 * s), 0, 1);
      const shoulderY = avgY(ls, rs);
      const hipY = avgY(lh, rh);
      const leaning = clamp((hipY - shoulderY) / (0.4 * s), 0, 1);
      return score01To100(fingerNearFace * 0.7 + leaning * 0.3);
    },
  },
  {
    name: 'Grinch Arms Crossed',
    description: 'Cross arms + make angry face',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      if (!lw || !rw || !ls || !rs) return 0;
      const s = dist(ls, rs);
      const leftCross = clamp(1 - Math.abs(lw.x - rs.x) / (0.5 * s), 0, 1);
      const rightCross = clamp(1 - Math.abs(rw.x - ls.x) / (0.5 * s), 0, 1);
      const chestLevel = clamp(
        1 - Math.abs(avgY(lw, rw) - avgY(ls, rs)) / (0.4 * s),
        0,
        1
      );
      return score01To100((leftCross + rightCross) / 2 * 0.7 + chestLevel * 0.3);
    },
  },
  {
    name: 'Broken Christmas Tree',
    description: 'Stand on one leg, hands up like a tree',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      const la = getKp(pose, 'left_ankle');
      const ra = getKp(pose, 'right_ankle');
      if (!lw || !rw || !nose || !la || !ra) return 0;
      const s = shoulderScale(pose);
      const handsUp = clamp((nose.y - avgY(lw, rw)) / (0.65 * s), 0, 1);
      const oneLegUp = clamp(Math.abs(la.y - ra.y) / (0.6 * s), 0, 1);
      return score01To100(handsUp * 0.5 + oneLegUp * 0.5);
    },
  },
  {
    name: 'Gift Surprise Reaction',
    description: 'Hands on cheeks, mouth wide open',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const le = getKp(pose, 'left_ear');
      const re = getKp(pose, 'right_ear');
      if (!lw || !rw || !le || !re) return 0;
      const s = shoulderScale(pose);
      const leftCheek = clamp(1 - dist(lw, le) / (0.55 * s), 0, 1);
      const rightCheek = clamp(1 - dist(rw, re) / (0.55 * s), 0, 1);
      return score01To100((leftCheek + rightCheek) / 2);
    },
  },
  {
    name: 'Sleigh Puller',
    description: 'Lean forward, both hands like pulling rope',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!lw || !rw || !ls || !rs || !lh || !rh) return 0;
      const s = shoulderScale(pose);
      const handsForward = clamp(avgY(lw, rw) - avgY(ls, rs), 0, 1);
      const shoulderY = avgY(ls, rs);
      const hipY = avgY(lh, rh);
      const leaning = clamp((hipY - shoulderY) / (0.5 * s), 0, 1);
      return score01To100(handsForward * 0.4 + leaning * 0.6);
    },
  },
  {
    name: 'North Pole Muscle Flex',
    description: 'Show your biceps - gym progress!',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const le = getKp(pose, 'left_ear');
      const re = getKp(pose, 'right_ear');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      if (!lw || !rw || !le || !re || !ls || !rs) return 0;
      const s = shoulderScale(pose);
      const leftFlex = clamp(1 - Math.abs(lw.y - ls.y) / (0.5 * s), 0, 1);
      const rightFlex = clamp(1 - Math.abs(rw.y - rs.y) / (0.5 * s), 0, 1);
      const wristsUp = clamp(
        (avgY(ls, rs) - avgY(lw, rw)) / (0.4 * s),
        0,
        1
      );
      return score01To100((leftFlex + rightFlex) / 2 * 0.6 + wristsUp * 0.4);
    },
  },
  {
    name: 'Chilling Snowman',
    description: 'Arms straight down, stand stiff',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!lw || !rw || !ls || !rs || !lh || !rh) return 0;
      const s = shoulderScale(pose);
      const armsDown = clamp(
        (avgY(lw, rw) - avgY(ls, rs)) / (0.8 * s),
        0,
        1
      );
      const hipLevel = avgY(lh, rh);
      const wristsBelowHips = clamp(
        (avgY(lw, rw) - hipLevel) / (0.5 * s),
        0,
        1
      );
      return score01To100(armsDown * 0.6 + wristsBelowHips * 0.4);
    },
  },
```

---

## 📝 Notes on Firebase
**You are currently using localStorage, NOT Firebase.** To use Firebase:

1. Install Firebase:
   ```bash
   npm install firebase
   ```

2. Create `lib/firebase.ts` with your Firebase config

3. Replace localStorage calls with Firestore writes

---

## ✅ Summary of Changes

| Feature | Status | Notes |
|---------|--------|-------|
| Timer = 20 sec | ✅ Done | Already set |
| Auto progression | ✅ Done | Already working |
| Accuracy-based scoring | ⚙️ Implement | 80% = 8 pts |
| Cumulative scores | ⚙️ Implement | Add up returning players |
| 15 new poses | ⚙️ Implement | Code ready above |
| Background music | ⚙️ Implement | Add audio file first |
| Firebase | ❌ Not set up | Using localStorage |
| Live leaderboard | ✅ Works | Updates on refresh |

The leaderboard **already updates live** when you reload the page. For real-time updates without refresh, you'd need Firebase Realtime Database or WebSockets.
