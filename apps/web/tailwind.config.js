/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          green: '#00FF88',
          red: '#FF4444',
          blue: '#00AAFF',
          purple: '#AA00FF',
          yellow: '#FFAA00',
        },
        dark: {
          bg: '#0A0A0F',
          card: '#1A1A2E',
          border: '#2A2A3E',
          text: '#E0E0E0',
          muted: '#808080',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'float-up': 'floatUp 2s ease-out forwards',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
        floatUp: {
          '0%': { 
            opacity: 1, 
            transform: 'translateY(0px) scale(1)' 
          },
          '100%': { 
            opacity: 0, 
            transform: 'translateY(-60px) scale(1.5)' 
          },
        },
        pulseRing: {
          '0%': {
            transform: 'scale(0.95)',
            opacity: 1,
          },
          '100%': {
            transform: 'scale(1.4)',
            opacity: 0,
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
