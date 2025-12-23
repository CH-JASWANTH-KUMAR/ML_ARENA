'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useMemo } from 'react';
import Link from 'next/link';
import Snowfall from './Snowfall';  
import gdglogo from "../public/gdglogo.jpg";  

export default function Hero() {
  const stars = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: `star-${i}`,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 50}%`,
        duration: 2 + Math.random() * 2,
        delay: Math.random() * 2,
      })),
    []
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#0a1929] via-[#1a237e] to-[#311b92]">
      {/* Snowfall Effect */}
      <Snowfall />

      {/* Ambient Background Elements */}
      <div className="absolute inset-0" aria-hidden="true">
        {/* Gradient Overlays */}
        <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-radial from-festive-red/10 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-blue-500/10 to-transparent blur-3xl" />
        
        {/* Twinkling Stars */}
        {stars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: star.left,
              top: star.top,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
            }}
          />
        ))}
      </div>

      {/* Main Content Container */}
      <div className="relative z-20 container mx-auto px-6 lg:px-12 min-h-screen flex items-center">
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
          {/* Left Side - Text Content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-festive-gold opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-festive-gold"></span>
                </span>
                <span className="text-snow-white text-sm font-medium tracking-wide">
                  GDG Christmas Special
                </span>
              </div>
            </motion.div>

            {/* Main Headline */}
            <motion.div variants={itemVariants} className="space-y-4">
              <h1 className="text-6xl lg:text-7xl xl:text-8xl font-bold text-white leading-tight">
                <span className="inline-block">
                  Santa&apos;s
                </span>
                <br />
                <span className="inline-block bg-gradient-to-r from-festive-red via-festive-gold to-festive-red bg-clip-text text-transparent animate-gradient">
                  ML Arena
                </span>
              </h1>

              {/* Sub-headline */}
              <h2 className="text-2xl lg:text-3xl text-blue-100 font-light">
                A 60-second AI pose challenge (Christmas edition)
              </h2>
            </motion.div>

            {/* Description */}
            <motion.p
              variants={itemVariants}
              className="text-lg text-blue-200 max-w-xl leading-relaxed"
            >
              Step in, strike the poses, and watch the AI score you live. Quick to start, fun to retry, and perfect for a crowd.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              {/* Primary CTA */}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                <Link
                  href="/arena"
                  className="group relative block w-full px-8 py-4 bg-gradient-to-r from-festive-red to-red-600 rounded-full text-white font-semibold text-lg shadow-2xl overflow-hidden"
                  aria-label="Enter the Arena"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-festive-gold to-yellow-400"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Enter the Arena
                    <motion.svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </motion.svg>
                  </span>
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(255, 215, 0, 0.5)',
                        '0 0 40px rgba(255, 215, 0, 0.8)',
                        '0 0 20px rgba(255, 215, 0, 0.5)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    aria-hidden="true"
                  />
                </Link>
              </motion.div>

              {/* Secondary CTA */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto"
              >
                <Link
                  href="/leaderboard"
                  className="block w-full px-8 py-4 bg-white/10 backdrop-blur-md rounded-full text-white font-semibold text-lg border-2 border-white/20 hover:bg-white/20 transition-all"
                  aria-label="View Live Leaderboard"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    View Live Leaderboard
                  </span>
                </Link>
              </motion.div>
            </motion.div>

            {/* GDG Branding */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3 pt-8 text-blue-200"
            >
              <Image
                src={gdglogo}
                alt="GDG Logo"
                height={40}
                width={40}/>
              <span className="text-sm font-light">Powered by Google Developer Groups</span>
            </motion.div>
          </motion.div>

          {/* Right Side - What to Expect (no image) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-2xl font-bold text-white">How it works</h3>
                <div className="text-xs text-blue-200">Camera stays on-device</div>
              </div>

              <div className="mt-6 space-y-4 text-blue-100">
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-festive-gold" />
                  <p><span className="font-semibold text-white">3 random poses</span> every player gets a fresh set</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-festive-gold" />
                  <p><span className="font-semibold text-white">20 seconds</span> per pose - pass or fail, you move on</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-festive-gold" />
                  <p><span className="font-semibold text-white">Hold 2 seconds</span> at <span className="font-semibold text-white">80%+</span> to pass</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-festive-gold" />
                  <p><span className="font-semibold text-white">Points = accuracy</span> (80% → 8 pts, 100% → 10 pts)</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-festive-gold" />
                  <p>Reach <span className="font-semibold text-white">80%+</span> and hold <span className="font-semibold text-white">2 seconds</span> to earn points</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-festive-gold" />
                  <p><span className="font-semibold text-white">Accuracy-based scoring:</span> 80% = 8 pts, 100% = 10 pts</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-festive-gold" />
                  <p>Best accuracy: full body visible + good lighting</p>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="text-xs text-blue-200">Model</div>
                  <div className="text-white font-semibold">MoveNet (Thunder)</div>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="text-xs text-blue-200">Camera</div>
                  <div className="text-white font-semibold">720p preferred</div>
                </div>
              </div>

              <div className="mt-7 flex gap-3">
                <Link href="/arena" className="flex-1">
                  <motion.button
                    className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 transition-all rounded-2xl text-white font-semibold border border-white/20"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Start Pose Game
                  </motion.button>
                </Link>
                <Link href="/leaderboard" className="flex-1">
                  <motion.button
                    className="w-full px-6 py-3 bg-white/5 hover:bg-white/10 transition-all rounded-2xl text-white font-semibold border border-white/10"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Leaderboard
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a1929] to-transparent" />
    </section>
  );
}
