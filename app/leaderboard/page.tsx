'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface LeaderboardEntry {
  name: string;
  score: number;
  accuracy: number;
  timestamp: string;
  attempts?: number;
}

interface DisplayEntry extends LeaderboardEntry {
  rank: number;
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [filter, setFilter] = useState<'today' | 'week' | 'alltime'>('alltime');
  const [stats, setStats] = useState({ totalPlayers: 0, gamesPlayed: 0, highScore: 0 });

  const backgroundStars = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        duration: 3 + Math.random() * 2,
        delay: Math.random() * 2,
      })),
    []
  );

  // Load real data from localStorage
  useEffect(() => {
    const loadLeaderboard = () => {
      const storedData = localStorage.getItem('leaderboard');
      if (!storedData) {
        setEntries([]);
        return;
      }

      let leaderboard: LeaderboardEntry[] = [];
      try {
        leaderboard = JSON.parse(storedData) as LeaderboardEntry[];
        if (!Array.isArray(leaderboard)) leaderboard = [];
      } catch {
        leaderboard = [];
      }
      
      // Filter by date
      const now = new Date();
      let filtered = leaderboard;

      if (filter === 'today') {
        filtered = leaderboard.filter((entry) => {
          const entryDate = new Date(entry.timestamp);
          return entryDate.toDateString() === now.toDateString();
        });
      } else if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = leaderboard.filter((entry) => {
          const entryDate = new Date(entry.timestamp);
          return entryDate >= weekAgo;
        });
      }

      // Sort by score (descending), then most recent first for ties
      const sorted = [...filtered].sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Add ranks
      const withRanks = sorted.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      setEntries(withRanks);

      // Calculate stats
      const uniquePlayers = new Set(leaderboard.map(e => e.name)).size;
      const maxScore = leaderboard.length > 0 ? Math.max(...leaderboard.map(e => e.score)) : 0;
      setStats({
        totalPlayers: uniquePlayers,
        gamesPlayed: leaderboard.length,
        highScore: maxScore,
      });
    };

    loadLeaderboard();

    // Refresh when returning to this tab/window (kiosk-friendly)
    window.addEventListener('focus', loadLeaderboard);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadLeaderboard();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Refresh when updated from another tab
    window.addEventListener('storage', loadLeaderboard);

    return () => {
      window.removeEventListener('focus', loadLeaderboard);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', loadLeaderboard);
    };
  }, [filter]);

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-400 to-yellow-600';
      case 2:
        return 'from-gray-300 to-gray-500';
      case 3:
        return 'from-orange-400 to-orange-600';
      default:
        return 'from-blue-400 to-blue-600';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '#1';
      case 2:
        return '#2';
      case 3:
        return '#3';
      default:
        return `#${rank}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1929] via-[#1a237e] to-[#311b92] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {backgroundStars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute w-2 h-2 bg-white rounded-full opacity-50"
            style={{
              left: star.left,
              top: star.top,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/"
              className="inline-flex px-6 py-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 hover:bg-white/20 transition-all"
              aria-label="Back to Home"
            >
              ← Back to Home
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/arena"
              className="inline-flex px-6 py-3 bg-gradient-to-r from-festive-red to-red-600 rounded-full text-white font-semibold shadow-xl"
              aria-label="Enter Arena"
            >
              Enter Arena 🎮
            </Link>
          </motion.div>
        </div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-bold text-white mb-4 flex items-center justify-center gap-4">
            Live Leaderboard
          </h1>
          <p className="text-xl text-blue-200">
            Top performers in Santa&apos;s ML Arena
          </p>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center gap-4 mb-8"
        >
          {(['today', 'week', 'alltime'] as const).map((filterOption) => (
            <motion.button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                filter === filterOption
                  ? 'bg-gradient-to-r from-festive-gold to-yellow-400 text-[#1a237e]'
                  : 'bg-white/10 backdrop-blur-md text-white border border-white/20'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {filterOption === 'today' && 'Today'}
              {filterOption === 'week' && 'This Week'}
              {filterOption === 'alltime' && 'All Time'}
            </motion.button>
          ))}
        </motion.div>

        {/* Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          {entries.length > 0 ? (
            <>
              {/* Top 3 Podium */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {entries.slice(0, 3).map((entry, index) => {
                  const positions = [1, 0, 2]; // Center first place
                  const actualIndex = positions[index];
                  const actualEntry = entries[actualIndex];
                  
                  if (!actualEntry) return null;
                  
                  return (
                    <motion.div
                      key={actualIndex}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className={`relative ${index === 1 ? 'order-first' : ''}`}
                    >
                      <div
                        className={`bg-gradient-to-br ${getRankColor(actualEntry.rank)} p-6 rounded-2xl text-center transform ${
                          actualEntry.rank === 1 ? 'scale-110 -translate-y-4' : ''
                        } shadow-2xl`}
                      >
                        <div className="text-6xl mb-3">{getRankIcon(actualEntry.rank)}</div>
                        <div className="text-white font-bold text-xl mb-2">{actualEntry.name}</div>
                        <div className="text-white/90 text-3xl font-bold">{actualEntry.score}</div>
                        <div className="text-white/70 text-sm mt-1">points</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Rest of leaderboard */}
              <div className="space-y-3">
                {entries.length > 3 && entries.slice(3).map((entry) => (
                  <motion.div
                    key={`${entry.name}-${entry.timestamp}-${entry.rank}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (entry.rank - 4) * 0.05 }}
                    className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-3xl w-12 text-center">{entry.rank}</div>
                        <div className="text-2xl">{getRankIcon(entry.rank)}</div>
                        <div className="flex-1">
                          <div className="text-white font-semibold text-lg">{entry.name}</div>
                          <div className="text-blue-200 text-sm">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-festive-gold font-bold text-2xl">{entry.score}</div>
                        <div className="text-white/70 text-sm">points</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-2">No scores yet!</h3>
              <p className="text-blue-200 mb-6">Be the first to play and set the record!</p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
                <Link
                  href="/arena"
                  className="inline-flex px-8 py-3 bg-gradient-to-r from-festive-red to-red-600 rounded-full text-white font-bold"
                  aria-label="Start Playing"
                >
                  Start Playing
                </Link>
              </motion.div>
            </div>
          )}

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-12 text-center"
          >
            <div className="bg-gradient-to-r from-festive-red/20 to-festive-gold/20 backdrop-blur-md rounded-2xl p-8 border-2 border-festive-gold/50">
              <h3 className="text-white text-2xl font-bold mb-3">
                Think you can make it to the top?
              </h3>
              <p className="text-blue-200 mb-6">
                Challenge yourself and compete for the #1 spot!
              </p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
                <Link
                  href="/arena"
                  className="inline-flex px-10 py-4 bg-gradient-to-r from-festive-red to-red-600 rounded-full text-white text-xl font-bold shadow-2xl"
                  aria-label="Enter Arena Now"
                >
                  Enter Arena Now
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center border border-white/20">
              <div className="text-festive-gold text-3xl font-bold">{stats.totalPlayers}</div>
              <div className="text-white/70 text-sm">Total Players</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center border border-white/20">
              <div className="text-festive-gold text-3xl font-bold">{stats.gamesPlayed}</div>
              <div className="text-white/70 text-sm">Games Played</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center border border-white/20">
              <div className="text-festive-gold text-3xl font-bold">{stats.highScore}</div>
              <div className="text-white/70 text-sm">High Score</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
