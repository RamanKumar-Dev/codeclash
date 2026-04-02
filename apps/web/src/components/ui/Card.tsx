import React from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'neon' | 'gradient' | 'dark';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  glow?: boolean;
  border?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  padding = 'md',
  hover = true,
  glow = false,
  border = true,
}) => {
  const baseClasses = 'relative rounded-2xl transition-all duration-300';
  
  const variants = {
    default: 'bg-gray-900/80 backdrop-blur-sm',
    glass: 'bg-white/10 backdrop-blur-md border border-white/20',
    neon: 'bg-gray-900/90 border border-cyan-500/30',
    gradient: 'bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur-sm',
    dark: 'bg-gray-950/95'
  };

  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10'
  };

  const borderStyles = {
    default: border ? 'border border-gray-800' : '',
    glass: border ? 'border border-white/20' : '',
    neon: border ? 'border border-cyan-500/30 shadow-lg shadow-cyan-500/20' : '',
    gradient: border ? 'border border-purple-500/30' : '',
    dark: border ? 'border border-gray-800' : ''
  };

  return (
    <motion.div
      className={clsx(
        baseClasses,
        variants[variant],
        paddings[padding],
        borderStyles[variant],
        hover && 'hover:transform hover:scale-105',
        glow && 'shadow-2xl',
        className
      )}
      whileHover={hover ? { y: -4 } : {}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {glow && (
        <>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 opacity-20 blur-xl" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-600 to-purple-600 opacity-10 blur-2xl" />
        </>
      )}
      
      {variant === 'neon' && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl" />
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export default Card;
