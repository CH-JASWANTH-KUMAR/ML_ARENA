'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import type { PoseDetector } from '@tensorflow-models/pose-detection';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY)
  : null;

interface Pose {
  keypoints: Array<{
    x: number;
    y: number;
    score?: number;
    name?: string;
  }>;
}

type Keypoint = Pose['keypoints'][number];

const MIN_KP_SCORE = 0.35;
const POSE_HOLD_SECONDS = 2;
const POSE_TIME_LIMIT_SECONDS = 20;
const POSE_TIME_LIMIT_MS = POSE_TIME_LIMIT_SECONDS * 1000;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const score01To100 = (t: number) => Math.round(clamp(t, 0, 1) * 100);

const getKp = (pose: Pose, name: string, minScore = MIN_KP_SCORE): Keypoint | null => {
  const kp = pose.keypoints.find((k) => k.name === name);
  if (!kp) return null;
  const score = kp.score ?? 0;
  if (score < minScore) return null;
  return kp;
};

const dist = (a: Keypoint, b: Keypoint) => Math.hypot(a.x - b.x, a.y - b.y);
const avgY = (a: Keypoint, b: Keypoint) => (a.y + b.y) / 2;
const avgX = (a: Keypoint, b: Keypoint) => (a.x + b.x) / 2;

// Angle at point b (a-b-c), in degrees.
const angleDeg = (a: Keypoint, b: Keypoint, c: Keypoint) => {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag1 = Math.hypot(abx, aby);
  const mag2 = Math.hypot(cbx, cby);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cos = clamp(dot / (mag1 * mag2), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
};

const shoulderScale = (pose: Pose) => {
  const ls = getKp(pose, 'left_shoulder');
  const rs = getKp(pose, 'right_shoulder');
  if (ls && rs) {
    const s = dist(ls, rs);
    if (s > 1) return s;
  }
  const lh = getKp(pose, 'left_hip');
  const rh = getKp(pose, 'right_hip');
  if (lh && rh) {
    const s = dist(lh, rh);
    if (s > 1) return s;
  }
  return 100;
};

// Simplified challenges array - Gemini will handle validation
const challenges: Array<{ name: string; description: string }> = [
  { name: 'T-Pose', description: 'Arms straight out to the sides' },
  { name: 'Hands Up', description: 'Raise both hands above your head' },
  { name: 'Arms Wide (Santa)', description: 'Open your arms wide' },
  { name: 'Hands on Hips', description: 'Place hands near your hips' },
  { name: 'Squat', description: 'Bend your knees (squat down)' },
  { name: 'Star Pose', description: 'Hands up and feet wide' },
  { name: 'Warrior', description: 'Wide stance + arms out' },
  { name: 'Clap', description: 'Bring your hands together' },
  { name: 'Balance (Left)', description: 'Stand on left leg (lift right foot)' },
  { name: 'High Knee (Left)', description: 'Lift your left knee up' },
];

// Helper function to validate pose using Gemini AI
async function validatePoseWithGemini(imageData: string, poseName: string, poseDescription: string): Promise<number> {
  try {
    if (!genAI) {
      console.warn('Gemini AI not initialized');
      return 0;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `You are a pose detection expert. Analyze this image and determine how accurately the person is performing the "${poseName}" pose.

Pose Description: ${poseDescription}

Please rate the accuracy from 0-100 where:
- 0-39: Not performing the pose or very inaccurate
- 40-59: Attempting the pose but significant errors
- 60-79: Good attempt, minor adjustments needed
- 80-100: Excellent execution of the pose

Respond with ONLY a number between 0 and 100. No other text.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData.split(',')[1], // Remove data:image/jpeg;base64, prefix
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const response = await result.response;
    const text = response.text().trim();
    const accuracy = parseInt(text);

    if (isNaN(accuracy)) {
      console.warn('Invalid Gemini response:', text);
      return 0;
    }

    return Math.min(100, Math.max(0, accuracy));
  } catch (error) {
    console.error('Gemini validation error:', error);
    return 0;
  }
}

// Demo Pose (generic for many challenges)
const DemoPose = ({ challenge }: { challenge: number }) => {
  {
    name: 'T-Pose',
    description: 'Arms straight out to the sides',
    validate: (pose) => {
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!ls || !rs || !lw || !rw) return 0;

      const s = dist(ls, rs);
      const span = Math.abs(rw.x - lw.x);
      const ratio = span / (s || 1);
      const wristsY = avgY(lw, rw);
      const shouldersY = avgY(ls, rs);
      const yDiff = Math.abs(wristsY - shouldersY) / (s || 1);

      const spanScore = clamp((ratio - 1.0) / (1.45 - 1.0), 0, 1);
      const levelScore = clamp(1 - yDiff / 0.30, 0, 1);
      return score01To100(spanScore * levelScore);
    },
  },
  {
    name: 'Hands Up',
    description: 'Raise both hands above your head',
    validate: (pose) => {
      const nose = getKp(pose, 'nose');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!nose || !lw || !rw) return 0;
      const s = shoulderScale(pose);
      const wristsY = avgY(lw, rw);
      const delta = (nose.y - wristsY) / s; // positive if wrists above head
      return score01To100(clamp(delta / 0.75, 0, 1));
    },
  },
  {
    name: 'Arms Wide (Santa)',
    description: 'Open your arms wide',
    validate: (pose) => {
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!ls || !rs || !lw || !rw) return 0;
      const s = dist(ls, rs);
      const span = Math.abs(rw.x - lw.x);
      const ratio = span / (s || 1);
      const score = clamp((ratio - 1.05) / (1.55 - 1.05), 0, 1);
      return score01To100(score);
    },
  },
  {
    name: 'Antlers (Reindeer)',
    description: 'Hands up near your head',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!lw || !rw || !nose) return 0;
      const s = shoulderScale(pose);
      const wristsY = avgY(lw, rw);
      const up = clamp((nose.y - wristsY) / (0.65 * s), 0, 1);
      const handsApart = clamp(Math.abs(rw.x - lw.x) / (1.2 * s), 0, 1);
      return score01To100(up * 0.7 + handsApart * 0.3);
    },
  },
  {
    name: 'Hands on Hips',
    description: 'Place hands near your hips',
    validate: (pose) => {
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!lh || !rh || !lw || !rw) return 0;
      const s = shoulderScale(pose);
      const left = clamp(1 - dist(lw, lh) / (0.9 * s), 0, 1);
      const right = clamp(1 - dist(rw, rh) / (0.9 * s), 0, 1);
      return score01To100((left + right) / 2);
    },
  },
  {
    name: 'Left Arm Up',
    description: 'Left hand up, right hand down',
    validate: (pose) => {
      const nose = getKp(pose, 'nose');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!nose || !ls || !rs || !lw || !rw) return 0;
      const s = shoulderScale(pose);
      const leftUp = clamp((nose.y - lw.y) / (0.7 * s), 0, 1);
      const rightDown = clamp((rw.y - rs.y) / (0.6 * s), 0, 1);
      return score01To100(leftUp * 0.65 + rightDown * 0.35);
    },
  },
  {
    name: 'Right Arm Up',
    description: 'Right hand up, left hand down',
    validate: (pose) => {
      const nose = getKp(pose, 'nose');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!nose || !ls || !rs || !lw || !rw) return 0;
      const s = shoulderScale(pose);
      const rightUp = clamp((nose.y - rw.y) / (0.7 * s), 0, 1);
      const leftDown = clamp((lw.y - ls.y) / (0.6 * s), 0, 1);
      return score01To100(rightUp * 0.65 + leftDown * 0.35);
    },
  },
  {
    name: 'Clap',
    description: 'Bring your hands together',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!lw || !rw) return 0;
      const s = shoulderScale(pose);
      const close = clamp(1 - dist(lw, rw) / (0.45 * s), 0, 1);
      return score01To100(close);
    },
  },
  {
    name: 'Touch Toes',
    description: 'Reach down towards your ankles',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const la = getKp(pose, 'left_ankle');
      const ra = getKp(pose, 'right_ankle');
      if (!lw || !rw || !la || !ra) return 0;
      const s = shoulderScale(pose);
      const left = clamp(1 - dist(lw, la) / (1.2 * s), 0, 1);
      const right = clamp(1 - dist(rw, ra) / (1.2 * s), 0, 1);
      return score01To100((left + right) / 2);
    },
  },
  {
    name: 'Squat',
    description: 'Bend your knees (squat down)',
    validate: (pose) => {
      const lh = getKp(pose, 'left_hip');
      const lk = getKp(pose, 'left_knee');
      const la = getKp(pose, 'left_ankle');
      const rh = getKp(pose, 'right_hip');
      const rk = getKp(pose, 'right_knee');
      const ra = getKp(pose, 'right_ankle');
      if (!lh || !lk || !la || !rh || !rk || !ra) return 0;
      const a1 = angleDeg(lh, lk, la);
      const a2 = angleDeg(rh, rk, ra);
      const avg = (a1 + a2) / 2;
      // 90deg = deep squat, 170deg = straight
      const bend = clamp((160 - avg) / (160 - 95), 0, 1);
      return score01To100(bend);
    },
  },
  {
    name: 'High Knee (Left)',
    description: 'Lift your left knee up',
    validate: (pose) => {
      const lh = getKp(pose, 'left_hip');
      const lk = getKp(pose, 'left_knee');
      const rh = getKp(pose, 'right_hip');
      if (!lh || !lk || !rh) return 0;
      const s = shoulderScale(pose);
      const lift = clamp((lh.y - lk.y) / (0.65 * s), 0, 1);
      const stable = clamp((lk.y - rh.y) / (1.2 * s), 0, 1); // keep other side not too high
      return score01To100(lift * 0.75 + stable * 0.25);
    },
  },
  {
    name: 'High Knee (Right)',
    description: 'Lift your right knee up',
    validate: (pose) => {
      const rh = getKp(pose, 'right_hip');
      const rk = getKp(pose, 'right_knee');
      const lh = getKp(pose, 'left_hip');
      if (!rh || !rk || !lh) return 0;
      const s = shoulderScale(pose);
      const lift = clamp((rh.y - rk.y) / (0.65 * s), 0, 1);
      const stable = clamp((rk.y - lh.y) / (1.2 * s), 0, 1);
      return score01To100(lift * 0.75 + stable * 0.25);
    },
  },
  {
    name: 'Side Lunge (Left)',
    description: 'Step wide and bend left knee',
    validate: (pose) => {
      const lh = getKp(pose, 'left_hip');
      const lk = getKp(pose, 'left_knee');
      const la = getKp(pose, 'left_ankle');
      const rh = getKp(pose, 'right_hip');
      const rk = getKp(pose, 'right_knee');
      const ra = getKp(pose, 'right_ankle');
      if (!lh || !lk || !la || !rh || !rk || !ra) return 0;
      const leftBend = clamp((160 - angleDeg(lh, lk, la)) / (160 - 100), 0, 1);
      const rightStraight = clamp((angleDeg(rh, rk, ra) - 145) / (175 - 145), 0, 1);
      return score01To100(leftBend * 0.7 + rightStraight * 0.3);
    },
  },
  {
    name: 'Side Lunge (Right)',
    description: 'Step wide and bend right knee',
    validate: (pose) => {
      const lh = getKp(pose, 'left_hip');
      const lk = getKp(pose, 'left_knee');
      const la = getKp(pose, 'left_ankle');
      const rh = getKp(pose, 'right_hip');
      const rk = getKp(pose, 'right_knee');
      const ra = getKp(pose, 'right_ankle');
      if (!lh || !lk || !la || !rh || !rk || !ra) return 0;
      const rightBend = clamp((160 - angleDeg(rh, rk, ra)) / (160 - 100), 0, 1);
      const leftStraight = clamp((angleDeg(lh, lk, la) - 145) / (175 - 145), 0, 1);
      return score01To100(rightBend * 0.7 + leftStraight * 0.3);
    },
  },
  {
    name: 'Balance (Left)',
    description: 'Stand on left leg (lift right foot)',
    validate: (pose) => {
      const la = getKp(pose, 'left_ankle');
      const ra = getKp(pose, 'right_ankle');
      const lk = getKp(pose, 'left_knee');
      const rk = getKp(pose, 'right_knee');
      if (!la || !ra || !lk || !rk) return 0;
      const s = shoulderScale(pose);
      const lift = clamp((ra.y - la.y) / (0.7 * s), 0, 1); // right ankle higher than left
      const kneeDiff = clamp((rk.y - lk.y) / (0.8 * s), 0, 1);
      return score01To100(lift * 0.7 + kneeDiff * 0.3);
    },
  },
  {
    name: 'Balance (Right)',
    description: 'Stand on right leg (lift left foot)',
    validate: (pose) => {
      const la = getKp(pose, 'left_ankle');
      const ra = getKp(pose, 'right_ankle');
      const lk = getKp(pose, 'left_knee');
      const rk = getKp(pose, 'right_knee');
      if (!la || !ra || !lk || !rk) return 0;
      const s = shoulderScale(pose);
      const lift = clamp((la.y - ra.y) / (0.7 * s), 0, 1);
      const kneeDiff = clamp((lk.y - rk.y) / (0.8 * s), 0, 1);
      return score01To100(lift * 0.7 + kneeDiff * 0.3);
    },
  },
  {
    name: 'Star Pose',
    description: 'Hands up and feet wide',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      const la = getKp(pose, 'left_ankle');
      const ra = getKp(pose, 'right_ankle');
      if (!lw || !rw || !nose || !la || !ra) return 0;
      const s = shoulderScale(pose);
      const wristsY = avgY(lw, rw);
      const handsUp = clamp((nose.y - wristsY) / (0.65 * s), 0, 1);
      const feetWide = clamp(Math.abs(ra.x - la.x) / (1.6 * s), 0, 1);
      return score01To100(handsUp * 0.6 + feetWide * 0.4);
    },
  },
  {
    name: 'Warrior',
    description: 'Wide stance + arms out',
    validate: (pose) => {
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const la = getKp(pose, 'left_ankle');
      const ra = getKp(pose, 'right_ankle');
      if (!ls || !rs || !lw || !rw || !la || !ra) return 0;
      const s = dist(ls, rs);
      const armSpan = clamp(Math.abs(rw.x - lw.x) / (1.45 * s), 0, 1);
      const wristsY = avgY(lw, rw);
      const shouldersY = avgY(ls, rs);
      const level = clamp(1 - Math.abs(wristsY - shouldersY) / (0.32 * s), 0, 1);
      const stance = clamp(Math.abs(ra.x - la.x) / (1.6 * s), 0, 1);
      return score01To100(armSpan * 0.5 + level * 0.2 + stance * 0.3);
    },
  },
  {
    name: 'Hands Behind Head',
    description: 'Put hands near your ears',
    validate: (pose) => {
      const le = getKp(pose, 'left_ear');
      const re = getKp(pose, 'right_ear');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!le || !re || !lw || !rw) return 0;
      const s = shoulderScale(pose);
      const left = clamp(1 - dist(lw, le) / (0.75 * s), 0, 1);
      const right = clamp(1 - dist(rw, re) / (0.75 * s), 0, 1);
      return score01To100((left + right) / 2);
    },
  },
  {
    name: 'Punch Left',
    description: 'Extend left arm forward',
    validate: (pose) => {
      const ls = getKp(pose, 'left_shoulder');
      const le = getKp(pose, 'left_elbow');
      const lw = getKp(pose, 'left_wrist');
      if (!ls || !le || !lw) return 0;
      const elbow = angleDeg(ls, le, lw);
      const straight = clamp((elbow - 135) / (175 - 135), 0, 1);
      return score01To100(straight);
    },
  },
  {
    name: 'Punch Right',
    description: 'Extend right arm forward',
    validate: (pose) => {
      const rs = getKp(pose, 'right_shoulder');
      const re = getKp(pose, 'right_elbow');
      const rw = getKp(pose, 'right_wrist');
      if (!rs || !re || !rw) return 0;
      const elbow = angleDeg(rs, re, rw);
      const straight = clamp((elbow - 135) / (175 - 135), 0, 1);
      return score01To100(straight);
    },
  },
  {
    name: 'Kick Left',
    description: 'Lift left foot up (kick)',
    validate: (pose) => {
      const lh = getKp(pose, 'left_hip');
      const la = getKp(pose, 'left_ankle');
      if (!lh || !la) return 0;
      const s = shoulderScale(pose);
      const lift = clamp((lh.y - la.y) / (0.75 * s), 0, 1);
      return score01To100(lift);
    },
  },
  {
    name: 'Kick Right',
    description: 'Lift right foot up (kick)',
    validate: (pose) => {
      const rh = getKp(pose, 'right_hip');
      const ra = getKp(pose, 'right_ankle');
      if (!rh || !ra) return 0;
      const s = shoulderScale(pose);
      const lift = clamp((rh.y - ra.y) / (0.75 * s), 0, 1);
      return score01To100(lift);
    },
  },
  {
    name: 'Lean Left',
    description: 'Lean body to the left',
    validate: (pose) => {
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!ls || !rs || !lh || !rh) return 0;
      const shoulderMidX = avgX(ls, rs);
      const hipMidX = avgX(lh, rh);
      const s = dist(ls, rs);
      const offset = (hipMidX - shoulderMidX) / (s || 1);
      // leaning left => hips shift right relative to shoulders in mirrored view; accept magnitude only
      return score01To100(clamp(Math.abs(offset) / 0.35, 0, 1));
    },
  },
  {
    name: 'Lean Right',
    description: 'Lean body to the right',
    validate: (pose) => {
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!ls || !rs || !lh || !rh) return 0;
      const shoulderMidX = avgX(ls, rs);
      const hipMidX = avgX(lh, rh);
      const s = dist(ls, rs);
      const offset = (shoulderMidX - hipMidX) / (s || 1);
      return score01To100(clamp(Math.abs(offset) / 0.35, 0, 1));
    },
  },
  {
    name: 'Elf Hop (Bend Knees)',
    description: 'Bend knees like you’re about to jump',
    validate: (pose) => {
      const lh = getKp(pose, 'left_hip');
      const lk = getKp(pose, 'left_knee');
      const la = getKp(pose, 'left_ankle');
      const rh = getKp(pose, 'right_hip');
      const rk = getKp(pose, 'right_knee');
      const ra = getKp(pose, 'right_ankle');
      if (!lh || !lk || !la || !rh || !rk || !ra) return 0;
      const a1 = angleDeg(lh, lk, la);
      const a2 = angleDeg(rh, rk, ra);
      const avg = (a1 + a2) / 2;
      const bend = clamp((155 - avg) / (155 - 105), 0, 1);
      return score01To100(bend);
    },
  },
  {
    name: 'Santa Salute',
    description: 'Right hand salute near forehead',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const re = getKp(pose, 'right_ear');
      if (!rw || !re) return 0;
      const s = shoulderScale(pose);
      const salute = clamp(1 - dist(rw, re) / (0.7 * s), 0, 1);
      return score01To100(salute);
    },
  },
  {
    name: 'Reindeer Jump',
    description: 'Both hands above head like antlers',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!lw || !rw || !nose) return 0;
      const s = shoulderScale(pose);
      const up = clamp((nose.y - avgY(lw, rw)) / (0.7 * s), 0, 1);
      const apart = clamp(Math.abs(rw.x - lw.x) / (1.4 * s), 0, 1);
      return score01To100(up * 0.6 + apart * 0.4);
    },
  },
  {
    name: 'Snowman Stand',
    description: 'Arms straight down, stand stiff',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!lw || !rw || !lh || !rh) return 0;
      const s = shoulderScale(pose);
      const armsDown = clamp((avgY(lw, rw) - avgY(lh, rh)) / (0.7 * s), 0, 1);
      return score01To100(armsDown);
    },
  },
  {
    name: 'Gift Box Squat',
    description: 'Squat down with hands together',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const lh = getKp(pose, 'left_hip');
      const lk = getKp(pose, 'left_knee');
      const la = getKp(pose, 'left_ankle');
      const rh = getKp(pose, 'right_hip');
      const rk = getKp(pose, 'right_knee');
      const ra = getKp(pose, 'right_ankle');
      if (!lw || !rw || !lh || !lk || !la || !rh || !rk || !ra) return 0;
      const s = shoulderScale(pose);
      const handsTogether = clamp(1 - dist(lw, rw) / (0.5 * s), 0, 1);
      const a1 = angleDeg(lh, lk, la);
      const a2 = angleDeg(rh, rk, ra);
      const squat = clamp((160 - (a1 + a2) / 2) / (160 - 100), 0, 1);
      return score01To100(handsTogether * 0.4 + squat * 0.6);
    },
  },
  {
    name: 'Christmas Tree',
    description: 'Hands above head forming triangle',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!lw || !rw || !nose) return 0;
      const s = shoulderScale(pose);
      const handsUp = clamp((nose.y - avgY(lw, rw)) / (0.6 * s), 0, 1);
      const together = clamp(1 - dist(lw, rw) / (0.8 * s), 0, 1);
      return score01To100(handsUp * 0.5 + together * 0.5);
    },
  },
  {
    name: 'Snowball Throw',
    description: 'Right hand behind head like throwing',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const rs = getKp(pose, 'right_shoulder');
      const re = getKp(pose, 'right_ear');
      if (!rw || !rs || !re) return 0;
      const s = shoulderScale(pose);
      const behindHead = clamp((rs.y - rw.y) / (0.5 * s), 0, 1);
      return score01To100(behindHead);
    },
  },
  {
    name: 'Grinch Pose',
    description: 'Arms crossed over chest',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      if (!lw || !rw || !ls || !rs) return 0;
      const s = dist(ls, rs);
      const crossed = clamp(1 - Math.abs((lw.x - rs.x) + (rw.x - ls.x)) / (1.2 * s), 0, 1);
      return score01To100(crossed);
    },
  },
  {
    name: 'Angel Wings',
    description: 'Arms out at 45 degrees up',
    validate: (pose) => {
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      if (!ls || !rs || !lw || !rw) return 0;
      const s = shoulderScale(pose);
      const shoulderY = avgY(ls, rs);
      const wristY = avgY(lw, rw);
      const upward = clamp((shoulderY - wristY) / (0.5 * s), 0, 1);
      const wide = clamp(Math.abs(rw.x - lw.x) / (1.5 * s), 0, 1);
      return score01To100(upward * 0.5 + wide * 0.5);
    },
  },
  {
    name: 'Candy Cane',
    description: 'One arm straight up, lean sideways',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!rw || !nose || !ls || !rs || !lh || !rh) return 0;
      const s = shoulderScale(pose);
      const armUp = clamp((nose.y - rw.y) / (0.65 * s), 0, 1);
      const shoulderMidX = avgX(ls, rs);
      const hipMidX = avgX(lh, rh);
      const lean = clamp(Math.abs(hipMidX - shoulderMidX) / (0.3 * s), 0, 1);
      return score01To100(armUp * 0.7 + lean * 0.3);
    },
  },
  {
    name: 'Ho Ho Ho',
    description: 'Both hands on belly',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      if (!lw || !rw || !lh || !rh || !ls || !rs) return 0;
      const bellyY = (avgY(ls, rs) + avgY(lh, rh)) / 2;
      const wristsY = avgY(lw, rw);
      const s = shoulderScale(pose);
      const onBelly = clamp(1 - Math.abs(wristsY - bellyY) / (0.4 * s), 0, 1);
      return score01To100(onBelly);
    },
  },
  {
    name: 'Sleigh Ride',
    description: 'Lean back, hands forward like holding reins',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const ls = getKp(pose, 'left_shoulder');
      const rs = getKp(pose, 'right_shoulder');
      if (!lw || !rw || !ls || !rs) return 0;
      const s = shoulderScale(pose);
      const handsForward = clamp((avgY(lw, rw) - avgY(ls, rs)) / (0.4 * s), 0, 1);
      return score01To100(handsForward);
    },
  },
  {
    name: 'Elf Dance',
    description: 'One knee up, hands on hips',
    validate: (pose) => {
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const lk = getKp(pose, 'left_knee');
      const rk = getKp(pose, 'right_knee');
      if (!lh || !rh || !lw || !rw || !lk || !rk) return 0;
      const s = shoulderScale(pose);
      const handsOnHips = clamp(1 - (dist(lw, lh) + dist(rw, rh)) / (1.5 * s), 0, 1);
      const kneeLift = clamp(Math.abs(lk.y - rk.y) / (0.6 * s), 0, 1);
      return score01To100(handsOnHips * 0.5 + kneeLift * 0.5);
    },
  },
  {
    name: 'Star on Top',
    description: 'Jump position - arms and legs wide',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const la = getKp(pose, 'left_ankle');
      const ra = getKp(pose, 'right_ankle');
      const nose = getKp(pose, 'nose');
      if (!lw || !rw || !la || !ra || !nose) return 0;
      const s = shoulderScale(pose);
      const armsWide = clamp(Math.abs(rw.x - lw.x) / (1.6 * s), 0, 1);
      const legsWide = clamp(Math.abs(ra.x - la.x) / (1.5 * s), 0, 1);
      const armsUp = clamp((nose.y - avgY(lw, rw)) / (0.6 * s), 0, 1);
      return score01To100(armsWide * 0.4 + legsWide * 0.3 + armsUp * 0.3);
    },
  },
  {
    name: 'Present Surprise',
    description: 'Hands near face in surprise',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!lw || !rw || !nose) return 0;
      const s = shoulderScale(pose);
      const nearFace = clamp(1 - (dist(lw, nose) + dist(rw, nose)) / (1.5 * s), 0, 1);
      return score01To100(nearFace);
    },
  },
  {
    name: 'Jingle Bell Rock',
    description: 'One hand up, one hand down',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      const lh = getKp(pose, 'left_hip');
      if (!lw || !rw || !nose || !lh) return 0;
      const s = shoulderScale(pose);
      const oneUp = Math.max(
        clamp((nose.y - lw.y) / (0.6 * s), 0, 1),
        clamp((nose.y - rw.y) / (0.6 * s), 0, 1)
      );
      const oneDown = Math.max(
        clamp((lw.y - lh.y) / (0.5 * s), 0, 1),
        clamp((rw.y - lh.y) / (0.5 * s), 0, 1)
      );
      return score01To100((oneUp + oneDown) / 2);
    },
  },
  {
    name: 'Frosty Wave',
    description: 'Wave with right hand high',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const rs = getKp(pose, 'right_shoulder');
      const nose = getKp(pose, 'nose');
      if (!rw || !rs || !nose) return 0;
      const s = shoulderScale(pose);
      const handUp = clamp((nose.y - rw.y) / (0.6 * s), 0, 1);
      const toSide = clamp(Math.abs(rw.x - rs.x) / (0.5 * s), 0, 1);
      return score01To100(handUp * 0.7 + toSide * 0.3);
    },
  },
  {
    name: 'Mistletoe Kiss',
    description: 'Blow a kiss - hand near lips',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!rw || !nose) return 0;
      const s = shoulderScale(pose);
      const nearMouth = clamp(1 - dist(rw, nose) / (0.6 * s), 0, 1);
      return score01To100(nearMouth);
    },
  },
  {
    name: 'Nutcracker March',
    description: 'Stand tall, one knee lifted high',
    validate: (pose) => {
      const lk = getKp(pose, 'left_knee');
      const rk = getKp(pose, 'right_knee');
      const lh = getKp(pose, 'left_hip');
      const rh = getKp(pose, 'right_hip');
      if (!lk || !rk || !lh || !rh) return 0;
      const s = shoulderScale(pose);
      const kneeLift = Math.max(
        clamp((lh.y - lk.y) / (0.65 * s), 0, 1),
        clamp((rh.y - rk.y) / (0.65 * s), 0, 1)
      );
      return score01To100(kneeLift);
    },
  },
  {
    name: 'Chimney Climb',
    description: 'Both arms reaching up high',
    validate: (pose) => {
      const lw = getKp(pose, 'left_wrist');
      const rw = getKp(pose, 'right_wrist');
      const nose = getKp(pose, 'nose');
      if (!lw || !rw || !nose) return 0;
      const s = shoulderScale(pose);
      const bothUp = clamp((nose.y - avgY(lw, rw)) / (0.8 * s), 0, 1);
      return score01To100(bothUp);
    },
  },
  {
    name: 'Santa\'s Bag Carry',
    description: 'One hand on shoulder carrying heavy bag',
    validate: (pose) => {
      const rw = getKp(pose, 'right_wrist');
      const rs = getKp(pose, 'right_shoulder');
      const re = getKp(pose, 'right_ear');
      if (!rw || !rs || !re) return 0;
      const s = shoulderScale(pose);
      const nearShoulder = clamp(1 - dist(rw, rs) / (0.6 * s), 0, 1);
      const handUp = clamp((rs.y - rw.y) / (0.4 * s), 0, 1);
      return score01To100(nearShoulder * 0.7 + handUp * 0.3);
    },
  },
];

// Demo Pose (generic for many challenges)
const DemoPose = ({ challenge }: { challenge: number }) => {
  const label = challenges[challenge]?.name ?? 'Pose';
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center">
      <div className="text-[10px] text-blue-200 tracking-widest">POSE</div>
      <div className="text-2xl font-extrabold text-white leading-none">{challenge + 1}</div>
      <div className="mt-1 text-[10px] text-blue-100 leading-tight px-1" style={{ maxHeight: 28, overflow: 'hidden' }}>
        {label}
      </div>
    </div>
  );
};

// Confetti (simplified)
const Confetti = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        driftX: (Math.random() - 0.5) * 100,
        duration: 2 + Math.random(),
        delay: i * 0.02,
        color: ['#FFD700', '#FF6B6B', '#4ECDC4'][i % 3],
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: p.left,
            top: -20,
            backgroundColor: p.color,
          }}
          animate={{
            y: ['-5vh', '110vh'],
            x: [0, p.driftX],
            rotate: [0, 360],
            opacity: [1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
};

export default function ArenaPage() {
  const [participantName, setParticipantName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicFallbackStopRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [gameState, setGameState] = useState<'name' | 'countdown' | 'playing' | 'finished'>('name');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [shuffledChallenges, setShuffledChallenges] = useState<typeof challenges>([]);
  const activeChallengesRef = useRef<typeof challenges>([]);
  const [score, setScore] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [detector, setDetector] = useState<PoseDetector | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [holdTime, setHoldTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [poseTimeLeft, setPoseTimeLeft] = useState(POSE_TIME_LIMIT_SECONDS);
  const [poseResults, setPoseResults] = useState<Array<'pending' | 'passed' | 'failed'>>(
    Array.from({ length: challenges.length }, () => 'pending')
  );
  const [poseBestAccuracies, setPoseBestAccuracies] = useState<number[]>([0, 0, 0]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const lastPoseEstimateMsRef = useRef<number>(0);
  const detectorRef = useRef<PoseDetector | null>(null);

  const tfRef = useRef<typeof import('@tensorflow/tfjs') | null>(null);
  const poseDetectionRef = useRef<typeof import('@tensorflow-models/pose-detection') | null>(null);

  const poseTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poseDeadlineMsRef = useRef<number | null>(null);
  const poseResolvedRef = useRef(false);
  const holdStartMsRef = useRef<number | null>(null);
  const poseBestAccuracyRef = useRef<number[]>([0, 0, 0]);

  const gameStateRef = useRef(gameState);
  const currentChallengeRef = useRef(currentChallenge);
  const scoreRef = useRef(score);
  const accuracyRef = useRef(accuracy);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    currentChallengeRef.current = currentChallenge;
  }, [currentChallenge]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    accuracyRef.current = accuracy;
  }, [accuracy]);

  const tfInitPromiseRef = useRef<Promise<void> | null>(null);

  const ensureTensorflowReady = () => {
    if (!tfInitPromiseRef.current) {
      tfInitPromiseRef.current = (async () => {
        try {
          if (!tfRef.current) {
            const tf = await import('@tensorflow/tfjs');
            // Load optional backends (best effort)
            await import('@tensorflow/tfjs-backend-webgl').catch(() => {});
            await import('@tensorflow/tfjs-backend-wasm').catch(() => {});
            tfRef.current = tf;
          }

          const tf = tfRef.current;
          if (!tf) return;

          // Prefer GPU backends; fall back gracefully.
          const preferredBackends: Array<'webgl' | 'wasm' | 'cpu'> = ['webgl', 'wasm', 'cpu'];
          for (const backend of preferredBackends) {
            try {
              await tf.setBackend(backend);
              await tf.ready();
              return;
            } catch {
              // try next backend
            }
          }

          // Last resort
          await tf.ready();
        } catch (err) {
          console.error('TF init error:', err);
        }
      })();
    }

    return tfInitPromiseRef.current;
  };

  // Initialize TensorFlow ONCE
  useEffect(() => {
    let mounted = true;
    
    const initTF = async () => {
      try {
        await ensureTensorflowReady();
        const tf = tfRef.current;
        console.log('TensorFlow ready:', tf?.getBackend?.());
      } catch (err) {
        console.error('TF init error:', err);
      }
    };
    
    if (mounted) initTF();
    
    return () => {
      mounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (musicFallbackStopRef.current) {
        musicFallbackStopRef.current();
        musicFallbackStopRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  const stopMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (musicFallbackStopRef.current) {
      musicFallbackStopRef.current();
      musicFallbackStopRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const startFestiveFallbackMusic = () => {
    if (typeof window === 'undefined') return;

    // Stop any previous fallback loop
    if (musicFallbackStopRef.current) {
      musicFallbackStopRef.current();
      musicFallbackStopRef.current = null;
    }

    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctx) return;

    const ctx = new Ctx();
    audioContextRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);

    // A simple, festive arpeggio loop (original pattern; not a copyrighted recording)
    const notesHz = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.0, 698.46];
    let step = 0;
    const stepMs = 220;

    const playStep = () => {
      const freq = notesHz[step % notesHz.length];
      step += 1;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(master);

      osc.start(now);
      osc.stop(now + 0.2);
    };

    // Ensure audio context is running (requires user gesture; startGame is a gesture)
    ctx.resume().catch(() => {});
    playStep();
    const intervalId = window.setInterval(playStep, stepMs);

    musicFallbackStopRef.current = () => {
      window.clearInterval(intervalId);
      master.disconnect();
    };
  };

  const startMusic = () => {
    // Try MP3 first. If missing/blocked, fall back to WebAudio.
    const sources = ['/background-music.mp3', '/background-christmas-music-453613.mp3'];

    if (!audioRef.current && typeof window !== 'undefined') {
      audioRef.current = new Audio(sources[0]);
      audioRef.current.loop = true;
      audioRef.current.volume = 0.15;
      audioRef.current.preload = 'auto';
    }

    const audio = audioRef.current;
    if (!audio) {
      startFestiveFallbackMusic();
      return;
    }

    // If the MP3 already failed to load, fall back immediately.
    if (audio.error) {
      startFestiveFallbackMusic();
      return;
    }

    // Stop fallback if it was playing
    if (musicFallbackStopRef.current) {
      musicFallbackStopRef.current();
      musicFallbackStopRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => {
        startFestiveFallbackMusic();
      });
    }

    // If the file is missing, try alternate source(s) before falling back.
    let sourceIndex = sources.indexOf(audio.src.replace(window.location.origin, ''));
    if (sourceIndex < 0) sourceIndex = 0;

    const tryNextSourceOrFallback = () => {
      sourceIndex += 1;
      if (sourceIndex >= sources.length) {
        startFestiveFallbackMusic();
        return;
      }
      audio.src = sources[sourceIndex];
      audio.load();
      const nextPlay = audio.play();
      if (nextPlay && typeof (nextPlay as Promise<void>).catch === 'function') {
        (nextPlay as Promise<void>).catch(() => {
          tryNextSourceOrFallback();
        });
      }
    };

    const onError = () => {
      audio.removeEventListener('error', onError);
      tryNextSourceOrFallback();
    };
    audio.addEventListener('error', onError, { once: true });
  };

  const startGame = () => {
    if (!participantName.trim()) {
      setNameError('Please enter your name to start.');
      return;
    }

    setNameError(null);
    setUiError(null);
    
    // Pick exactly 3 random poses for THIS participant.
    // Use a ref so timers/detection always see the right list immediately.
    const selected = [...challenges].sort(() => Math.random() - 0.5).slice(0, 3);
    activeChallengesRef.current = selected;
    setShuffledChallenges(selected);

    // Start background music (requires user gesture; this is the gesture)
    startMusic();
    
    localStorage.setItem('lastPlayerName', participantName);
    setPoseResults(Array.from({ length: 3 }, () => 'pending'));
    setPoseBestAccuracies([0, 0, 0]);
    poseBestAccuracyRef.current = [0, 0, 0];
    poseResolvedRef.current = false;
    holdStartMsRef.current = null;
    setPoseTimeLeft(POSE_TIME_LIMIT_SECONDS);
    setCurrentChallenge(0);
    currentChallengeRef.current = 0;
    setScore(0);
    scoreRef.current = 0;
    setAccuracy(0);
    accuracyRef.current = 0;
    setGameState('countdown');

    let count = 3;
    setCountdown(count);
    
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count === 0) {
        clearInterval(interval);
        setTimeout(initializeCamera, 300);
      }
    }, 1000);
  };

  const clearPoseTimer = () => {
    if (poseTimerIntervalRef.current) {
      clearInterval(poseTimerIntervalRef.current);
      poseTimerIntervalRef.current = null;
    }
    poseDeadlineMsRef.current = null;
  };

  const startPoseTimer = () => {
    clearPoseTimer();
    poseResolvedRef.current = false;
    holdStartMsRef.current = null;
    setHoldTime(0);
    setAccuracy(0);
    const idx = currentChallengeRef.current;
    poseBestAccuracyRef.current[idx] = 0;
    setPoseBestAccuracies((prev) => {
      if (prev[idx] === 0) return prev;
      const next = [...prev];
      next[idx] = 0;
      return next;
    });
    poseDeadlineMsRef.current = performance.now() + POSE_TIME_LIMIT_MS;
    setPoseTimeLeft(POSE_TIME_LIMIT_SECONDS);

    poseTimerIntervalRef.current = setInterval(() => {
      if (gameStateRef.current !== 'playing') return;
      const deadline = poseDeadlineMsRef.current;
      if (!deadline) return;
      const remainingMs = deadline - performance.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      
      // Only update if different to avoid unnecessary rerenders
      setPoseTimeLeft((prev) => {
        if (prev !== remainingSec) return remainingSec;
        return prev;
      });

      if (remainingMs <= 0) {
        clearPoseTimer();
        if (poseResolvedRef.current) return;
        poseResolvedRef.current = true;

        const idx = currentChallengeRef.current;

        // Award points even on timeout/fail based on best accuracy reached in this round.
        const bestAcc = poseBestAccuracyRef.current[idx] ?? 0;
        const earnedPoints = Math.floor(bestAcc / 10);
        if (earnedPoints > 0) {
          setScore((prev) => {
            const next = prev + earnedPoints;
            scoreRef.current = next;
            return next;
          });
        }

        setPoseResults((prev) => {
          const next = [...prev];
          if (next[idx] === 'pending') next[idx] = 'failed';
          return next;
        });

        const active = activeChallengesRef.current;
        if (idx < active.length - 1) {
          setCurrentChallenge((prev) => {
            const next = prev + 1;
            currentChallengeRef.current = next;
            return next;
          });
          setHoldTime(0);
          setPoseTimeLeft(POSE_TIME_LIMIT_SECONDS);
          startPoseTimer();
        } else {
          finishGame();
        }
      }
    }, 200);
  };

  const initializeCamera = async () => {
    try {
      setIsLoading(true);
      setUiError(null);
      const tryConstraints: MediaStreamConstraints[] = [
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            facingMode: 'user',
          },
          audio: false,
        },
        {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
            facingMode: 'user',
          },
          audio: false,
        },
      ];

      let mediaStream: MediaStream | null = null;
      for (const constraints of tryConstraints) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch {
          // try next
        }
      }

      if (!mediaStream) {
        throw new Error('Unable to access camera with available constraints');
      }

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();

            // Make sure TF is ready before creating the detector.
            await ensureTensorflowReady();

            const poseDetection = poseDetectionRef.current ?? (await import('@tensorflow-models/pose-detection'));
            poseDetectionRef.current = poseDetection;
            
            // Load model (prefer accuracy, fallback to faster model)
            let poseDetector: PoseDetector;
            try {
              poseDetector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                {
                  modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                  enableSmoothing: true,
                }
              );
            } catch {
              poseDetector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                {
                  modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
                  enableSmoothing: true,
                }
              );
            }
            
            detectorRef.current = poseDetector;
            setDetector(poseDetector);
            setIsLoading(false);
            gameStateRef.current = 'playing';
            setGameState('playing');
            startPoseTimer();
            startDetection(poseDetector);
          } catch (err) {
            console.error('Error:', err);
            setIsLoading(false);
            try {
              mediaStream?.getTracks().forEach((t) => t.stop());
            } catch {
              // ignore
            }
            gameStateRef.current = 'name';
            setGameState('name');
            setUiError('Failed to start the game. Please refresh and try again.');
          }
        };
      }
    } catch (error) {
      console.error('Camera error:', error);
      let message = 'Camera access was denied. Please allow camera access and try again.';
      const name = (error as any)?.name as string | undefined;
      if (name === 'NotFoundError') message = 'No camera was found on this device.';
      if (name === 'NotReadableError') message = 'Camera is in use by another app. Close it and try again.';
      if (name === 'OverconstrainedError') message = 'Camera settings are not supported on this device. Try again.';

      setUiError(message);
      gameStateRef.current = 'name';
      setGameState('name');
    }
  };

  const startDetection = (poseDetector: PoseDetector) => {
    // Keep this signature compatible with existing calls; the runtime detector is still the same.
    const detect = async () => {
      if (!videoRef.current || !canvasRef.current || gameStateRef.current === 'finished') {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Throttle heavy pose estimation work to reduce CPU/GPU load on kiosk devices.
      // Keep the animation loop running for smooth UI, but estimate at a lower rate.
      const now = performance.now();
      const MIN_ESTIMATE_INTERVAL_MS = 80; // ~12.5 FPS
      if (now - lastPoseEstimateMsRef.current < MIN_ESTIMATE_INTERVAL_MS) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      lastPoseEstimateMsRef.current = now;

      try {
        const poses = await poseDetector.estimatePoses(video, {
          maxPoses: 1,
          flipHorizontal: true,
        });
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (poses.length > 0) {
          const pose = poses[0] as Pose;
          drawSkeleton(ctx, pose);

          // Once a round is resolved (pass/timeout), freeze the UI until we switch rounds.
          if (poseResolvedRef.current) {
            if (gameStateRef.current === 'playing') {
              animationFrameRef.current = requestAnimationFrame(detect);
            }
            return;
          }

          // Calculate accuracy using custom validation
          const challengeIndex = currentChallengeRef.current;
          const active = activeChallengesRef.current;
          const currentAccuracy = active.length > 0 && active[challengeIndex]
            ? active[challengeIndex].validate(pose)
            : 0;
          const roundedAccuracy = Math.round(currentAccuracy);
          accuracyRef.current = roundedAccuracy;
          setAccuracy((prev) => (prev === roundedAccuracy ? prev : roundedAccuracy));

          // Track best accuracy this round (for scoring on both pass and fail).
          if (roundedAccuracy > (poseBestAccuracyRef.current[challengeIndex] ?? 0)) {
            poseBestAccuracyRef.current[challengeIndex] = roundedAccuracy;
            setPoseBestAccuracies((prev) => {
              if (prev[challengeIndex] === roundedAccuracy) return prev;
              const next = [...prev];
              next[challengeIndex] = roundedAccuracy;
              return next;
            });
          }

          if (currentAccuracy >= 80) {
            if (holdStartMsRef.current === null) {
              holdStartMsRef.current = performance.now();
            }
            const holdSeconds = (performance.now() - (holdStartMsRef.current ?? performance.now())) / 1000;
            const holdDisplay = Math.floor(holdSeconds * 10) / 10;
            setHoldTime((prev) => (Math.abs(prev - holdDisplay) < 0.0001 ? prev : holdDisplay));

            if (!poseResolvedRef.current && holdSeconds >= POSE_HOLD_SECONDS) {
              poseResolvedRef.current = true;
              holdStartMsRef.current = null;
              clearPoseTimer();
              
              // Award points based on accuracy (80% = 8 points, 100% = 10 points)
              const bestAcc = poseBestAccuracyRef.current[challengeIndex] ?? Math.round(currentAccuracy);
              setAccuracy((prev) => (prev === bestAcc ? prev : bestAcc));
              const earnedPoints = Math.floor(bestAcc / 10);
              setScore(prev => {
                const next = prev + earnedPoints;
                scoreRef.current = next;
                return next;
              });
              setShowCelebration(true);

              setPoseResults((prev) => {
                const next = [...prev];
                next[challengeIndex] = 'passed';
                return next;
              });

              setTimeout(() => {
                setShowCelebration(false);

                const active = activeChallengesRef.current;
                if (currentChallengeRef.current < active.length - 1) {
                  setCurrentChallenge(prev => {
                    const next = prev + 1;
                    currentChallengeRef.current = next;
                    return next;
                  });
                  setHoldTime(0);
                  setPoseTimeLeft(POSE_TIME_LIMIT_SECONDS);
                  startPoseTimer();
                } else {
                  finishGame();
                }
              }, 1000);
            }
          } else {
            holdStartMsRef.current = null;
            setHoldTime((prev) => (prev === 0 ? prev : 0));
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
      }

      if (gameStateRef.current === 'playing') {
        animationFrameRef.current = requestAnimationFrame(detect);
      }
    };

    detect();
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, pose: Pose) => {
    // Draw connections first (behind keypoints)
    const connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle'],
    ];

    connections.forEach(([start, end]) => {
      const startKp = pose.keypoints.find(kp => kp.name === start);
      const endKp = pose.keypoints.find(kp => kp.name === end);

      if (startKp?.score && endKp?.score && startKp.score > 0.3 && endKp.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    });

    // Draw keypoints on top
    pose.keypoints.forEach(kp => {
      if (kp.score && kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };

  const finishGame = () => {
    gameStateRef.current = 'finished';
    clearPoseTimer();
    setGameState('finished');
    setShowCelebration(true);

    stopMusic();

    const finalScore = scoreRef.current;
    const rounds = Math.max(1, activeChallengesRef.current.length || 3);
    const finalAccuracy = Math.round(
      poseBestAccuracyRef.current.slice(0, rounds).reduce((sum, v) => sum + (v || 0), 0) / rounds
    );

    const existing = localStorage.getItem('leaderboard');
    let leaderboard: any[] = [];
    try {
      leaderboard = existing ? (JSON.parse(existing) as any[]) : [];
      if (!Array.isArray(leaderboard)) leaderboard = [];
    } catch {
      leaderboard = [];
    }
    
    // Find existing player and accumulate scores
    const existingPlayerIndex = leaderboard.findIndex(
      (entry) => entry.name.toLowerCase() === participantName.toLowerCase()
    );
    
    if (existingPlayerIndex !== -1) {
      // Update existing player score (accumulate)
      leaderboard[existingPlayerIndex].score += finalScore;
      leaderboard[existingPlayerIndex].accuracy = finalAccuracy;
      leaderboard[existingPlayerIndex].timestamp = new Date().toISOString();
      leaderboard[existingPlayerIndex].attempts = (leaderboard[existingPlayerIndex].attempts || 1) + 1;
    } else {
      // New player
      leaderboard.push({
        name: participantName,
        score: finalScore,
        accuracy: finalAccuracy,
        timestamp: new Date().toISOString(),
        attempts: 1,
      });
    }
    
    // Keep storage bounded for kiosk/stall usage (preserve best players).
    leaderboard = leaderboard
      .filter((e) => e && typeof e.name === 'string')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 200);
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (detectorRef.current) {
        try {
          detectorRef.current.dispose();
        } catch {
          // ignore
        }
        detectorRef.current = null;
      }
      clearPoseTimer();
    };
  }, [stream]);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-[#0a1929] via-[#1a237e] to-[#311b92] overflow-hidden">
      {showCelebration && <Confetti />}

      {/* Name Entry */}
      <AnimatePresence>
        {gameState === 'name' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-md w-full mx-4 border border-white/20"
            >
              <h2 className="text-3xl font-bold text-white mb-3 text-center">
                Santa&apos;s Arena
              </h2>
              <p className="text-blue-200 mb-6 text-center text-sm">
                Enter your name to start
              </p>

              {uiError && (
                <div
                  className="mb-4 rounded-xl bg-red-500/10 border border-red-400/30 px-4 py-3 text-sm text-red-100"
                  role="alert"
                >
                  {uiError}
                </div>
              )}

              <input
                type="text"
                value={participantName}
                onChange={(e) => {
                  setParticipantName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Your Name"
                className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-festive-gold mb-4"
                onKeyDown={(e) => e.key === 'Enter' && startGame()}
                autoFocus
              />

              {nameError && (
                <div className="-mt-2 mb-4 text-sm text-red-200" role="status">
                  {nameError}
                </div>
              )}
              <motion.button
                onClick={startGame}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-6 py-3 bg-gradient-to-r from-festive-red to-red-700 text-white rounded-xl font-bold shadow-lg"
              >
                Start Game
              </motion.button>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/"
                  className="block w-full mt-3 px-6 py-2 bg-white/10 text-white rounded-xl border border-white/20 text-center"
                  aria-label="Back to Home"
                >
                  Back
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown */}
      <AnimatePresence>
        {gameState === 'countdown' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-50 bg-black/70"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-8xl font-bold text-festive-gold"
            >
              {countdown === 0 ? 'GO!' : countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80 backdrop-blur-sm"
          >
            <div className="w-16 h-16 border-4 border-festive-gold border-t-transparent rounded-full animate-spin mb-4" />
            <h2 className="text-2xl font-bold text-white">Loading AI Model...</h2>
            <p className="text-blue-200">Getting Santa&apos;s magic ready!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera View */}
      {(gameState === 'playing' || gameState === 'countdown') && (
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            playsInline
            muted
            aria-label="Camera preview"
          />

          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full scale-x-[-1]"
          />

          {gameState === 'playing' && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
                <div className="flex items-center justify-between max-w-6xl mx-auto">
                  <div className="flex items-center gap-4">
                    <div className="bg-black/50 backdrop-blur rounded-xl p-3 w-24 h-28 border border-festive-gold/50">
                      <DemoPose challenge={currentChallenge} />
                    </div>
                    
                    <div>
                      <h3 className="text-2xl font-bold text-white">
                        {(shuffledChallenges[currentChallenge] ?? activeChallengesRef.current[currentChallenge])?.name}
                      </h3>
                      <p className="text-blue-200">{(shuffledChallenges[currentChallenge] ?? activeChallengesRef.current[currentChallenge])?.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-festive-gold">{score}</div>
                    <div className="text-xs text-blue-200">Points</div>
                  </div>
                </div>
              </div>

              {/* Bottom Bar */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <div className="max-w-6xl mx-auto">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-white font-bold">Accuracy:</span>
                    <span className="text-3xl font-bold text-festive-gold">{accuracy}%</span>
                    <div className="flex-1 h-4 bg-white/20 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-festive-gold to-yellow-300"
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                    {accuracy >= 80 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="bg-green-500 text-white px-3 py-1 rounded-full font-bold text-sm"
                      >
                        {Math.ceil(2 - holdTime)}s
                      </motion.div>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-blue-200">
                    <span>Challenge {currentChallenge + 1}/3</span>
                    <span>
                      {accuracy >= 80 ? 'Hold it!' : accuracy >= 60 ? 'Almost there!' : 'Match the pose!'}
                    </span>
                    <span>Time: {poseTimeLeft}s</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Finished */}
      <AnimatePresence>
        {gameState === 'finished' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center z-50 bg-gradient-to-br from-[#0a1929] via-[#1a237e] to-[#311b92]"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-xl w-full mx-4 border border-white/20 text-center"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-4xl font-bold text-white mb-3">
                Great Job, {participantName}!
              </h2>
              <div className="mb-6">
                <div className="text-6xl font-bold text-festive-gold mb-1">{score}</div>
                <div className="text-xl text-blue-200">Total Points Earned</div>
              </div>
              <div className="mb-6 text-blue-200">
                <div className="text-sm">
                  Passed: <span className="font-bold text-white">{poseResults.filter(r => r === 'passed').length}</span>
                  {' • '}Failed: <span className="font-bold text-white">{poseResults.filter(r => r === 'failed').length}</span>
                  {' • '}Total: <span className="font-bold text-white">3</span>
                </div>
              </div>
              <div className="flex gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Link
                    href="/leaderboard"
                    className="block w-full px-6 py-3 bg-gradient-to-r from-festive-gold to-yellow-600 text-black rounded-xl font-bold"
                    aria-label="View Leaderboard"
                  >
                    Leaderboard
                  </Link>
                </motion.div>
                <motion.button
                  onClick={() => {
                    setGameState('name');
                    setCurrentChallenge(0);
                    setScore(0);
                    setAccuracy(0);
                    setParticipantName('');
                    setNameError(null);
                    setUiError(null);
                    setHoldTime(0);
                    setPoseTimeLeft(POSE_TIME_LIMIT_SECONDS);
                    setPoseResults(Array.from({ length: 3 }, () => 'pending'));
                    poseResolvedRef.current = false;
                    holdStartMsRef.current = null;
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl font-bold border border-white/20"
                >
                  Play Again
                </motion.button>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/"
                  className="block w-full mt-3 px-6 py-2 bg-white/5 text-white rounded-xl border border-white/10"
                  aria-label="Home"
                >
                  Home
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
