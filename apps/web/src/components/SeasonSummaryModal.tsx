import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SeasonSummary, SeasonReward } from '@code-clash/shared-types';

interface SeasonSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonSummary: SeasonSummary | null;
}

const SeasonSummaryModal: React.FC<SeasonSummaryModalProps> = ({
  isOpen,
  onClose,
  seasonSummary
}) => {
  const [timeUntilNextSeason, setTimeUntilNextSeason] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    if (!seasonSummary?.nextSeasonStart) return;

    const updateCountdown = () => {
      const now = new Date();
      const nextSeason = new Date(seasonSummary.nextSeasonStart);
      const diff = nextSeason.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilNextSeason({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeUntilNextSeason({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [seasonSummary?.nextSeasonStart]);

  const getRewardIcon = (rewardType: string) => {
    switch (rewardType) {
      case 'badge': return '🏆';
      case 'tokens': return '💰';
      case 'xp': return '⭐';
      case 'title': return '👑';
      default: return '🎁';
    }
  };

  const getRewardColor = (rewardType: string) => {
    switch (rewardType) {
      case 'badge': return 'text-yellow-400';
      case 'tokens': return 'text-green-400';
      case 'xp': return 'text-purple-400';
      case 'title': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  if (!isOpen || !seasonSummary) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 20 }}
          className="relative bg-gray-800 rounded-2xl border border-purple-500 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="relative p-6 border-b border-gray-700">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="text-6xl mb-4"
              >
                🎊
              </motion.div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-2">
                Season Complete!
              </h2>
              <p className="text-gray-400">
                {seasonSummary.season.name} has ended
              </p>
            </div>
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Your Rank */}
            {seasonSummary.userRank !== undefined && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-700/50 rounded-lg p-4 text-center"
              >
                <div className="text-sm text-gray-400 mb-1">Your Final Rank</div>
                <div className="text-4xl font-bold text-purple-400 mb-2">
                  #{seasonSummary.userRank}
                </div>
                <div className="text-lg text-gray-300">
                  Final ELO: {seasonSummary.userElo}
                </div>
              </motion.div>
            )}

            {/* Rewards */}
            {seasonSummary.userRewards.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="text-xl font-semibold mb-4 text-white">Rewards Earned</h3>
                <div className="grid grid-cols-2 gap-3">
                  {seasonSummary.userRewards.map((reward, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="bg-gray-700/50 rounded-lg p-3 flex items-center gap-3"
                    >
                      <span className="text-2xl">{getRewardIcon(reward.rewardType)}</span>
                      <div>
                        <div className={`font-semibold ${getRewardColor(reward.rewardType)}`}>
                          {typeof reward.value === 'number' ? reward.value.toLocaleString() : reward.value}
                        </div>
                        <div className="text-xs text-gray-400">{reward.description}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ELO Journey Chart */}
            {seasonSummary.eloJourney.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <h3 className="text-xl font-semibold mb-4 text-white">ELO Journey</h3>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="h-32 flex items-end justify-between gap-1">
                    {seasonSummary.eloJourney.slice(-20).map((point, index) => {
                      const maxElo = Math.max(...seasonSummary.eloJourney.map(p => p.elo));
                      const minElo = Math.min(...seasonSummary.eloJourney.map(p => p.elo));
                      const height = ((point.elo - minElo) / (maxElo - minElo)) * 100;
                      
                      return (
                        <motion.div
                          key={index}
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: 0.7 + index * 0.05 }}
                          className="flex-1 bg-gradient-to-t from-purple-600 to-pink-600 rounded-t"
                          title={`${new Date(point.date).toLocaleDateString()}: ${point.elo} ELO`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>Start</span>
                    <span>End</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Next Season Countdown */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-4 text-center"
            >
              <h3 className="text-xl font-semibold mb-2 text-white">Next Season Starts In</h3>
              <div className="flex justify-center gap-4">
                {timeUntilNextSeason.days > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-white">{timeUntilNextSeason.days}</div>
                    <div className="text-xs text-white/80">days</div>
                  </div>
                )}
                <div>
                  <div className="text-2xl font-bold text-white">{timeUntilNextSeason.hours}</div>
                  <div className="text-xs text-white/80">hours</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{timeUntilNextSeason.minutes}</div>
                  <div className="text-xs text-white/80">minutes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{timeUntilNextSeason.seconds}</div>
                  <div className="text-xs text-white/80">seconds</div>
                </div>
              </div>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="text-center"
            >
              <button
                onClick={onClose}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105"
              >
                Ready for Next Season!
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SeasonSummaryModal;
