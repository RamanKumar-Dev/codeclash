import React from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neon' | 'glow';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  pulse?: boolean;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  pulse = false,
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-bold rounded-full transition-all duration-300';
  
  const variants = {
    default: 'bg-gray-800 text-gray-300 border border-gray-700',
    success: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30',
    warning: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/30',
    danger: 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/30',
    info: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30',
    neon: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50 border border-cyan-400/30',
    glow: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50 animate-pulse'
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <motion.span
      className={clsx(
        baseClasses,
        variants[variant],
        sizes[size],
        pulse && 'animate-pulse',
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {(variant === 'neon' || variant === 'glow') && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 opacity-30 blur-md" />
      )}
      
      <span className="relative z-10">{children}</span>
    </motion.span>
  );
};

export default Badge;
