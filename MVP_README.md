# Code-Clash MVP: Arena of Algorithms

A real-time 1v1 competitive coding game for hackathon demonstration.

## Quick Start

```bash
# Clone and start all services
git clone <repo>
cd code-clash-mvp

# Start backend
cd server
npm install
npm run dev

# Start frontend (new terminal)
cd ../client
npm install
npm run dev

# Start Redis (new terminal)
redis-server

# Start Judge0 (new terminal)
docker run -p 2358:2358 judge0/judge0:latest
```

## Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Judge0**: http://localhost:2358

## MVP Features

### Core Gameplay
- ✅ User authentication (register/login)
- ✅ Real-time matchmaking (any-pair matching)
- ✅ Live battle rooms with countdown
- ✅ Code execution via Judge0
- ✅ Damage calculation based on correctness and speed
- ✅ HP bars and battle end screen
- ✅ Basic ELO system

### Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Zustand
- **Backend**: Node.js + Express + Socket.io + Redis
- **Code Execution**: Judge0 CE API
- **Database**: MongoDB (for user stats and battle history)

### Battle Flow
1. Login → Lobby
2. Click "Find Match" → Wait for opponent
3. 3-second countdown → Battle starts
4. Write code → Submit → Judge0 executes
5. Damage dealt based on test results
6. Battle ends when HP reaches 0
7. ELO updated → Return to lobby

### Damage Formula
- **0 tests passed**: 0 damage
- **Partial passes**: `passedCount * 3` damage
- **All passed**: `Math.round((50 * speedMultiplier) + efficiencyBonus)`
- **Speed multiplier**: `max(0.5, 1 - (elapsedTime / timeLimit))`
- **Efficiency bonus**: +10 if runtime < p50RuntimeMs
- **Max damage**: 60 HP

### Starting HP
- **Each player**: 300 HP (shorter battles for demo)

### Puzzle Set (5 hardcoded)
1. Two Sum (Easy)
2. Valid Palindrome (Easy)
3. FizzBuzz (Easy)
4. Fibonacci Number (Medium)
5. Valid Parentheses (Medium)

## What's NOT in MVP

- ❌ Spells and abilities
- ❌ Seasonal rankings
- ❌ Friend system
- ❌ Spectator mode
- ❌ Admin panel
- ❌ GitHub OAuth
- ❌ Private matches
- ❌ Weekly leaderboards
- ❌ Complex ELO calculations

## Development Notes

### Environment Variables
```bash
# Backend (.env)
JWT_SECRET=mvp-secret-key
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:3000
JUDGE0_URL=http://localhost:2358
PORT=3001
```

### Socket Events
- `queue:join` → Join matchmaking
- `match:found` → Opponent found
- `battle:submit` → Submit code
- `battle:damage` → Damage dealt
- `battle:end` → Battle over

### Rate Limiting
- Auth endpoints: 10 requests/minute
- No rate limiting on battle submissions (MVP)

## Production Considerations

For production deployment, add:
- Database persistence (MongoDB)
- Redis persistence
- Proper error handling
- Input validation
- SSL/TLS
- Load balancing
- Monitoring

## Architecture

```
├── client/          # React frontend
│   ├── src/
│   │   ├── pages/   # Login, Lobby, Battle, Leaderboard
│   │   ├── stores/  # Zustand state management
│   │   └── components/
├── server/          # Node.js backend
│   ├── src/
│   │   ├── middleware/  # Auth, validation
│   │   ├── services/    # Matchmaking, battle logic
│   │   └── routes/      # REST endpoints
└── shared/          # TypeScript types
    └── src/
        └── mvp-types.ts  # Shared interfaces
```
