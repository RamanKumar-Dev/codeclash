import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface SeasonCountdownBannerProps {
  seasonName?: string;
  className?: string;
}

const SeasonCountdownBanner: React.FC<SeasonCountdownBannerProps> = ({ 
  seasonName = 'Current Season', 
  className = '' 
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTimeUntilEnd = async () => {
      try {
        // Mock API call - replace with actual API
        // const response = await fetch('/api/leaderboard/time-until-season-end');
        // const data = await response.json();
        
        // Mock data for demonstration
        const mockData = { days: 12, hours: 4, minutes: 22, seconds: 45 };
        setTimeLeft(mockData);
      } catch (error) {
        console.error('Failed to fetch season end time:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeUntilEnd();

    // Update countdown every second
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const totalSeconds = prev.days * 86400 + prev.hours * 3600 + prev.minutes * 60 + prev.seconds - 1;
        
        if (totalSeconds <= 0) {
          clearInterval(interval);
          return { days: 0, hours: 0, minutes: 0, seconds: 0 };
        }

        return {
          days: Math.floor(totalSeconds / 86400),
          hours: Math.floor((totalSeconds % 86400) / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className={`bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 ${className}`}>
        <div className="max-w-7xl mx-auto text-center">
          <div className="animate-pulse">Loading season info...</div>
        </div>
      </div>
    );
  }

  const hasTimeLeft = timeLeft.days > 0 || timeLeft.hours > 0 || timeLeft.minutes > 0 || timeLeft.seconds > 0;

  if (!hasTimeLeft) {
    return (
      <div className={`bg-gradient-to-r from-orange-600 to-red-600 text-white p-4 ${className}`}>
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-bold"
          >
            🎉 Season has ended! New season starting soon...
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 ${className}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="text-2xl"
            >
              ⏰
            </motion.div>
            <div>
              <div className="text-sm opacity-90">{seasonName}</div>
              <div className="text-lg font-bold">ends in</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {timeLeft.days > 0 && (
              <motion.div
                key={`days-${timeLeft.days}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-center min-w-[60px]"
              >
                <div className="text-2xl font-bold">{timeLeft.days}</div>
                <div className="text-xs opacity-90">days</div>
              </motion.div>
            )}

            {timeLeft.hours > 0 && (
              <motion.div
                key={`hours-${timeLeft.hours}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-center min-w-[60px]"
              >
                <div className="text-2xl font-bold">{timeLeft.hours}</div>
                <div className="text-xs opacity-90">hours</div>
              </motion.div>
            )}

            <motion.div
              key={`minutes-${timeLeft.minutes}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-center min-w-[60px]"
            >
              <div className="text-2xl font-bold">{timeLeft.minutes}</div>
              <div className="text-xs opacity-90">min</div>
            </motion.div>

            <motion.div
              key={`seconds-${timeLeft.seconds}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-center min-w-[60px]"
            >
              <div className="text-2xl font-bold">{timeLeft.seconds}</div>
              <div className="text-xs opacity-90">sec</div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonCountdownBanner;
