'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

export default function SantaCharacter() {
  const [eyeBlink, setEyeBlink] = useState(false);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: `sparkle-${i}`,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: i * 0.3,
      })),
    []
  );

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyeBlink(true);
      setTimeout(() => setEyeBlink(false), 150);
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Festive Background Glow */}
      <motion.div
        className="absolute inset-0 bg-gradient-radial from-festive-red/20 via-transparent to-transparent"
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        aria-hidden="true"
      />

      {/* Santa Character Container */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          y: [0, -10, 0],
        }}
        transition={{
          opacity: { duration: 0.8 },
          scale: { duration: 0.8 },
          y: {
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        }}
      >
        {/* Santa SVG Illustration */}
        <svg
          width="400"
          height="400"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-2xl"
        >
          {/* Santa's Hat */}
          <motion.path
            d="M200 50 L150 120 L250 120 Z"
            fill="#c62828"
            initial={{ rotate: -5 }}
            animate={{ rotate: [5, -5, 5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <circle cx="200" cy="50" r="15" fill="#f8f9ff" />
          <ellipse cx="200" cy="120" rx="55" ry="12" fill="#f8f9ff" />

          {/* Santa's Face */}
          <circle cx="200" cy="180" r="60" fill="#ffd4a3" />

          {/* Eyes */}
          <motion.g
            animate={{ scaleY: eyeBlink ? 0.1 : 1 }}
            transition={{ duration: 0.1 }}
          >
            <circle cx="185" cy="170" r="6" fill="#1a1a1a" />
            <circle cx="215" cy="170" r="6" fill="#1a1a1a" />
          </motion.g>

          {/* Rosy Cheeks */}
          <circle cx="170" cy="185" r="10" fill="#ff6b9d" opacity="0.5" />
          <circle cx="230" cy="185" r="10" fill="#ff6b9d" opacity="0.5" />

          {/* Beard */}
          <path
            d="M160 195 Q200 240 240 195"
            stroke="#f8f9ff"
            strokeWidth="40"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="200" cy="210" r="30" fill="#f8f9ff" />
          <circle cx="170" cy="215" r="20" fill="#f8f9ff" />
          <circle cx="230" cy="215" r="20" fill="#f8f9ff" />

          {/* Nose */}
          <circle cx="200" cy="185" r="8" fill="#ff8a80" />

          {/* Body */}
          <rect x="160" y="230" width="80" height="100" rx="10" fill="#c62828" />
          <rect x="170" y="235" width="60" height="90" fill="#d32f2f" />
          
          {/* Belt */}
          <rect x="150" y="280" width="100" height="15" fill="#1a1a1a" />
          <rect x="190" y="275" width="20" height="25" rx="3" fill="#ffd700" />

          {/* Arms */}
          <motion.ellipse
            cx="140"
            cy="260"
            rx="20"
            ry="35"
            fill="#c62828"
            animate={{ rotate: [-5, 5, -5] }}
            style={{ originX: '140px', originY: '260px' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.ellipse
            cx="260"
            cy="260"
            rx="20"
            ry="35"
            fill="#c62828"
            animate={{ rotate: [5, -5, 5] }}
            style={{ originX: '260px', originY: '260px' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Hands */}
          <circle cx="130" cy="285" r="15" fill="#ffd4a3" />
          <circle cx="270" cy="285" r="15" fill="#ffd4a3" />
        </svg>
      </motion.div>

      {/* Floating Ornaments */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-8 h-8 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${
              ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d00'][i]
            }, ${['#1a73e8', '#c5221f', '#f9ab00', '#0f9d58', '#e65100'][i]})`,
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 2) * 40}%`,
          }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: 3 + i,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.2,
          }}
        >
          <div className="absolute top-0 left-1/2 w-1 h-3 bg-festive-gold transform -translate-x-1/2 -translate-y-full" />
        </motion.div>
      ))}

      {/* Sparkles */}
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          className="absolute w-2 h-2"
          style={{
            left: s.left,
            top: s.top,
          }}
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: s.delay,
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="#ffd700">
            <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}
