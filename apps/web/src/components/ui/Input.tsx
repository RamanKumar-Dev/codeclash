import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'glass' | 'neon' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  variant = 'default',
  size = 'md',
  className,
  ...props
}) => {
  const baseClasses = 'w-full rounded-xl border transition-all duration-300 focus:outline-none focus:ring-2 placeholder-gray-400';
  
  const variants = {
    default: 'bg-gray-800/50 border-gray-700 focus:border-purple-500 focus:ring-purple-500/50',
    glass: 'bg-white/10 backdrop-blur-md border-white/20 focus:border-cyan-400 focus:ring-cyan-400/50 text-white',
    neon: 'bg-gray-900/90 border-cyan-500/30 focus:border-cyan-400 focus:ring-cyan-400/50 text-white shadow-lg shadow-cyan-500/20',
    gradient: 'bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30 focus:border-purple-400 focus:ring-purple-400/50 text-white'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-4 text-lg'
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        
        <input
          className={clsx(
            baseClasses,
            variants[variant],
            sizes[size],
            icon && 'pl-10',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/50',
            className
          )}
          {...props}
        />
        
        {variant === 'neon' && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl pointer-events-none" />
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-400 animate-pulse">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
