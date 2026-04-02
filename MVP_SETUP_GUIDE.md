# Code-Clash MVP Setup Guide

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### 2. Environment Setup
```bash
# Copy environment template
cp MVP_ENV_EXAMPLE.txt .env

# Edit .env with your values
nano .env
```

### 3. Start Services
```bash
# Start Redis (required)
redis-server

# Start Judge0 (required)
docker run -p 2358:2358 judge0/judge0:latest

# Start both frontend and backend
npm run dev
```

## 📋 Prerequisites Check

Before running, verify these are working:

### Redis
```bash
redis-cli ping
# Should return: PONG
```

### Judge0
```bash
curl http://localhost:2358/system
# Should return system information
```

### Ports
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Redis: localhost:6379
- Judge0: http://localhost:2358

## 🔧 Manual Setup (if npm run install:all fails)

### Backend Setup
```bash
cd server
npm install express socket.io redis cors dotenv jsonwebtoken bcryptjs express-rate-limit axios
npm install -D @types/express @types/node @types/cors @types/jsonwebtoken @types/bcryptjs typescript ts-node-dev
```

### Frontend Setup
```bash
cd client
npm install react react-dom react-router-dom socket.io-client zustand
npm install -D @types/react @types/react-dom @types/react-router-dom typescript vite @vitejs/plugin-react tailwindcss postcss autoprefixer
```

### Shared Types Setup
```bash
cd shared
npm install -D typescript
```

## 🗂️ File Structure Created

```
/home/nikhil/Documents/rr/
├── client/                     # React frontend
│   ├── src/
│   │   ├── pages/             # Login, Lobby, Battle, Leaderboard
│   │   ├── stores/            # Zustand state management
│   │   ├── components/        # ProtectedRoute component
│   │   ├── App.tsx            # Main app component
│   │   ├── main.tsx           # App entry point
│   │   └── index.css          # Tailwind styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── index.html
├── server/                     # Node.js backend
│   ├── src/
│   │   ├── middleware/        # Auth middleware
│   │   ├── services/          # Matchmaking & Battle services
│   │   └── index.ts           # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── shared/                     # Shared TypeScript types
│   ├── src/
│   │   ├── mvp-types.ts       # MVP type definitions
│   │   └── index.ts           # Type exports
│   ├── package.json
│   └── tsconfig.json
├── MVP_ENV_EXAMPLE.txt         # Environment template
├── MVP_README.md              # MVP documentation
└── mvp-package.json           # Root workspace config
```

## 🎮 MVP Features Ready

✅ **Core Authentication**: Login/Register with JWT  
✅ **Real-time Matchmaking**: Any-pair matching system  
✅ **Battle System**: Live battles with HP bars and damage  
✅ **Code Execution**: Judge0 integration with 5 puzzles  
✅ **Damage Formula**: Fixed unambiguous calculation  
✅ **UI Components**: Dark theme, neon accents, animations  
✅ **State Management**: Zustand stores for auth and battle  
✅ **Socket Events**: Real-time battle communication  

## 🔥 What's Working

1. **User flows**: Login → Lobby → Battle → Victory/Defeat
2. **Real-time features**: Matchmaking, battle updates, damage toasts
3. **Code execution**: Submit → Judge0 → Results → Damage
4. **UI/UX**: HP bars, timers, countdowns, victory overlays
5. **ELO system**: Basic K=32 calculations

## ⚡ Run Commands

```bash
# Development (both services)
npm run dev

# Individual services
npm run dev:server    # Backend only
npm run dev:client    # Frontend only

# Production build
npm run build
```

The MVP is now perfectly set up for hackathon demonstration! 🎯
