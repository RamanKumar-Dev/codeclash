/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-green': '#00FF88',
        'neon-red': '#FF4444',
        'dark-bg': '#0F172A',
        'dark-surface': '#1E293B',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s',
        'float-up': 'floatUp 2s ease-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        floatUp: {
          '0%': { 
            opacity: 1, 
            transform: 'translateY(0px)' 
          },
          '100%': { 
            opacity: 0, 
            transform: 'translateY(-30px)' 
          },
        },
      },
    },
  },
  plugins: [],
}
