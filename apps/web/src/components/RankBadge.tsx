import React from 'react';
import { motion } from 'framer-motion';
import { RankTier, RANK_TIERS } from '@code-clash/shared-types';

interface RankBadgeProps {
  elo: number;
  size?: 'sm' | 'md' | 'lg';
  showElo?: boolean;
  showBorder?: boolean;
  className?: string;
}

const RankBadge: React.FC<RankBadgeProps> = ({ 
  elo, 
  size = 'md', 
  showElo = true, 
  showBorder = true,
  className = '' 
}) => {
  const rankTier = getRankTier(elo);
  
  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs',
      icon: 'text-sm',
      elo: 'text-xs'
    },
    md: {
      container: 'px-3 py-1.5 text-sm',
      icon: 'text-base',
      elo: 'text-sm'
    },
    lg: {
      container: 'px-4 py-2 text-base',
      icon: 'text-lg',
      elo: 'text-base'
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        inline-flex items-center gap-1.5 rounded-full font-semibold
        ${rankTier.bgColor} ${rankTier.color}
        ${showBorder ? rankTier.borderColor : ''}
        ${sizeClasses[size].container}
        ${className}
      `}
    >
      <span className={sizeClasses[size].icon}>{rankTier.icon}</span>
      <span>{rankTier.name}</span>
      {showElo && (
        <span className={`font-mono ${sizeClasses[size].elo} opacity-80`}>
          {elo}
        </span>
      )}
    </motion.div>
  );
};

export function getRankTier(elo: number): RankTier {
  for (const tier of Object.values(RANK_TIERS)) {
    if (elo >= tier.minElo && elo <= tier.maxElo) {
      return tier;
    }
  }
  return RANK_TIERS.STONE;
}

export default RankBadge;
