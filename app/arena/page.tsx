'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy load TensorFlow only when needed
let tf: any = null;
let poseDetection: any = null;
let modelCache: any = null;

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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getKp = (pose: Pose, name: string, minScore = MIN_KP_SCORE): Keypoint | null => {
  const kp = pose.keypoints.find((k) => k.name === name);
  if (!kp) return null;
  const score = kp.score ?? 0;
  if (score < minScore) return null;
  return kp;
};

// Simplified challenges array
const challenges = [
  { name: 'T-Pose', description: 'Arms straight out to the sides like a T' },
  { name: 'Hands Up', description: 'Raise both hands straight above your head' },
  { name: 'Arms Wide', description: 'Open your arms wide to the sides' },
  { name: 'Hands on Hips', description: 'Place both hands on your hips' },
  { name: 'Squat', description: 'Bend your knees and squat down' },
  { name: 'Star Pose', description: 'Hands up and feet wide apart like a star' },
  { name: 'Warrior', description: 'Wide stance with arms stretched out' },
  { name: 'Clap', description: 'Bring your hands together in front of you' },
  { name: 'Balance Left', description: 'Stand on left leg, lift right foot' },
  { name: 'High Knee', description: 'Lift your left knee up high' },
];

// Validate pose using Gemini AI
async function validatePoseWithGemini(
  imageData: string, 
  poseName: string, 
  poseDescription: string
): Promise<number> {
  try {
    if (!genAI) {
      console.error('Gemini AI not initialized - check API key');
      return 0;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `You are a pose detection expert. Analyze this image and determine how accurately the person is performing the "${poseName}" pose.

Pose Description: ${poseDescription}

Rate the accuracy from 0-100 where:
- 0-39: Not performing the pose or very inaccurate
- 40-59: Attempting the pose but significant errors
- 60-79: Good attempt, minor adjustments needed
- 80-100: Excellent execution of the pose

Respond with ONLY a number between 0 and 100. No other text.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData.split(',')[1],
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const response = await result.response;
    const text = response.text().trim();
    const accuracy = parseInt(text);

    return isNaN(accuracy) ? 0 : Math.min(100, Math.max(0, accuracy));
  } catch (error) {
    console.error('Gemini validation error:', error);
    return 0;
  }
}

export default function ArenaPage() {
  const [participantName, setParticipantName] = useState('');
  const [gameState, setGameState] = useState<'name' | 'countdown' | 'playing' | 'finished'>('name');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [score, setScore] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [detector, setDetector] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [holdTime, setHoldTime] = useState(0);
  const [poseTimeLeft, setPoseTimeLeft] = useState(POSE_TIME_LIMIT_SECONDS);
  const [isValidating, setIsValidating] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const holdStartRef = useRef<number | null>(null);
  const poseResolvedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startGame = async () => {
    if (!participantName.trim()) return;
    
    setGameState('countdown');
    let count = 3;
    setCountdown(count);
    
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count === 0) {
        clearInterval(interval);
        initializeCamera();
      }
    }, 1000);
  };

  const initializeCamera = async () => {
    try {
      setIsLoading(true);
      console.log('🚀 Starting initialization...');
      
      // Load TensorFlow dynamically for faster initial page load
      if (!tf) {
        console.log('📦 Loading TensorFlow.js...');
        tf = await import('@tensorflow/tfjs');
        await import('@tensorflow/tfjs-backend-webgl');
        console.log('✅ TensorFlow loaded');
      }
      
      // Initialize backend
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('✅ WebGL backend ready');
      } catch (tfError) {
        console.warn('⚠️  WebGL failed, trying WASM...');
        await tf.setBackend('wasm');
        await tf.ready();
        console.log('✅ WASM backend ready');
      }
      
      // Load pose detection
      if (!poseDetection) {
        console.log('📦 Loading Pose Detection library...');
        poseDetection = await import('@tensorflow-models/pose-detection');
        console.log('✅ Pose Detection loaded');
      }
      
      // Get camera stream
      console.log('📹 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' 
        },
        audio: false,
      });
      
      console.log('✅ Camera access granted');
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            console.log('✅ Video playing');
            
            // Load or reuse cached MoveNet THUNDER model
            if (!modelCache) {
              console.log('🤖 Loading MoveNet THUNDER model (this may take a moment)...');
              modelCache = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                { 
                  modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                  enableSmoothing: true 
                }
              );
              console.log('✅ Model loaded and cached!');
            } else {
              console.log('✅ Using cached model');
            }
            
            setDetector(modelCache);
            setIsLoading(false);
            setGameState('playing');
            startDetection(modelCache);
          } catch (modelError) {
            console.error('❌ Model loading error:', modelError);
            setIsLoading(false);
            alert('Failed to load AI model. Please refresh and try again.\n\nError: ' + modelError);
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }
          }
        };
        
        videoRef.current.onerror = (error) => {
          console.error('❌ Video error:', error);
          setIsLoading(false);
          alert('Video stream error. Please refresh and try again.');
        };
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Failed to access camera. Please allow camera access and try again.\n\nError: ' + errorMessage);
    }
  };

  const captureScreenshot = (): string => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    if (!video) return '';
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    // Flip horizontally to match what user sees
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const startDetection = async (poseDetector: any) => {
    const detect = async () => {
      if (!videoRef.current || !canvasRef.current || gameState === 'finished') {
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

      try {
        const poses = await poseDetector.estimatePoses(video, {
          maxPoses: 1,
          flipHorizontal: true,
        });
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (poses.length > 0) {
          const pose = poses[0] as Pose;
          drawSkeleton(ctx, pose);

          // Check if person is holding still (basic check)
          const hasGoodDetection = pose.keypoints.filter(kp => (kp.score || 0) > 0.3).length >= 10;

          if (hasGoodDetection && !poseResolvedRef.current && !isValidating) {
            if (holdStartRef.current === null) {
              holdStartRef.current = Date.now();
            }
            
            const holdDuration = (Date.now() - holdStartRef.current) / 1000;
            setHoldTime(holdDuration);

            if (holdDuration >= POSE_HOLD_SECONDS) {
              poseResolvedRef.current = true;
              setIsValidating(true);
              
              // Capture screenshot and validate with Gemini
              const screenshot = captureScreenshot();
              const challenge = challenges[currentChallenge];
              
              const geminiAccuracy = await validatePoseWithGemini(
                screenshot,
                challenge.name,
                challenge.description
              );
              
              setAccuracy(geminiAccuracy);
              setIsValidating(false);
              
              // Award points
              const points = Math.floor(geminiAccuracy / 10);
              setScore(prev => prev + points);
              
              // Move to next challenge after short delay
              setTimeout(() => {
                if (currentChallenge < challenges.length - 1) {
                  setCurrentChallenge(prev => prev + 1);
                  poseResolvedRef.current = false;
                  holdStartRef.current = null;
                  setHoldTime(0);
                  setAccuracy(0);
                } else {
                  finishGame();
                }
              }, 2000);
            }
          } else if (!hasGoodDetection) {
            holdStartRef.current = null;
            setHoldTime(0);
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
      }

      if (gameState === 'playing') {
        animationFrameRef.current = requestAnimationFrame(detect);
      }
    };

    detect();
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, pose: Pose) => {
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
    setGameState('finished');
    
    // Save to leaderboard
    const leaderboard = JSON.parse(localStorage.getItem('leaderboard') || '[]');
    leaderboard.push({
      name: participantName,
      score,
      accuracy,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    
    // Cleanup
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-[#0a1929] via-[#1a237e] to-[#311b92]">
      {/* Name Entry */}
      <AnimatePresence>
        {gameState === 'name' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center z-50 bg-black/50"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-md w-full mx-4">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">
                Santa&apos;s Arena
              </h2>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Your Name"
                className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4"
                onKeyDown={(e) => e.key === 'Enter' && startGame()}
                autoFocus
              />
              <button
                onClick={startGame}
                className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold"
              >
                Start Game
              </button>
              <Link
                href="/"
                className="block w-full mt-3 px-6 py-2 bg-white/10 text-white rounded-xl text-center"
              >
                Back
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown */}
      <AnimatePresence>
        {gameState === 'countdown' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center z-50 bg-black/70"
          >
            <div className="text-8xl font-bold text-yellow-400">
              {countdown === 0 ? 'GO!' : countdown}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-white">Loading AI Model...</h2>
        </div>
      )}

      {/* Camera View */}
      {gameState === 'playing' && (
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full scale-x-[-1]"
          />

          <div className="absolute inset-0 pointer-events-none">
            {/* Top Info */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
              <div className="flex items-center justify-between max-w-6xl mx-auto">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {challenges[currentChallenge].name}
                  </h3>
                  <p className="text-blue-200">{challenges[currentChallenge].description}</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-yellow-400">{score}</div>
                  <div className="text-xs text-blue-200">Points</div>
                </div>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
              <div className="max-w-6xl mx-auto">
                {isValidating ? (
                  <div className="text-center text-white font-bold">
                    🤖 Gemini AI is analyzing your pose...
                  </div>
                ) : accuracy > 0 ? (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-400 mb-2">
                      Accuracy: {accuracy}%
                    </div>
                    <div className="text-white">
                      {accuracy >= 80 ? '🎉 Excellent!' : accuracy >= 60 ? '👍 Good job!' : '💪 Keep trying!'}
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-white font-bold mb-2">
                      {holdTime > 0 ? `Hold for ${Math.ceil(POSE_HOLD_SECONDS - holdTime)}s more...` : 'Match the pose and hold still!'}
                    </div>
                    <div className="text-sm text-blue-200">
                      Challenge {currentChallenge + 1}/{challenges.length}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finished */}
      {gameState === 'finished' && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-xl w-full mx-4 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-4xl font-bold text-white mb-3">
              Great Job, {participantName}!
            </h2>
            <div className="mb-6">
              <div className="text-6xl font-bold text-yellow-400 mb-1">{score}</div>
              <div className="text-xl text-blue-200">Total Points</div>
            </div>
            <div className="flex gap-3">
              <Link
                href="/leaderboard"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black rounded-xl font-bold"
              >
                Leaderboard
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl font-bold"
              >
                Play Again
              </button>
            </div>
            <Link
              href="/"
              className="block w-full mt-3 px-6 py-2 bg-white/5 text-white rounded-xl"
            >
              Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
