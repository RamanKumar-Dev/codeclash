# Code-Clash: Arena of Algorithms - Integration Plan

## Overview
This document outlines how to integrate the valuable components extracted from the Lootcode repository into your "Code-Clash: Arena of Algorithms" project.

## Extracted Components

### 1. Code Execution System ✅
**Location**: `/packages/backend/src/services/code-execution.service.ts`

**Features**:
- Docker-based sandboxed code execution
- Multi-language support (Python, Java, C++, C, Rust, Go, C#)
- Secure compilation and runtime pipeline
- Test case management with input/output files
- Timeout handling and resource limits
- Comprehensive error handling

**Integration Steps**:
1. Add required dependencies: `zx`, `Docker`
2. Create `code-runner` Docker image (see Lootcode's dockerfile)
3. Set up temporary directory structure for code execution
4. Integrate with your battle submission system

### 2. Puzzle Management System ✅
**Location**: `/packages/backend/src/services/puzzle.service.ts`

**Features**:
- Structured puzzle format with metadata
- Difficulty-based organization
- ELO range filtering
- Test case management (visible + hidden)
- Caching system for performance
- Region/chapter organization

**Integration Steps**:
1. Create puzzle directory structure similar to Lootcode
2. Migrate or create puzzle metadata files
3. Set up caching layer (Redis recommended)
4. Integrate with matchmaking system for puzzle selection

### 3. Battle/Combat Mechanics ✅
**Location**: `/packages/backend/src/services/battle.service.ts`

**Features**:
- Complete battle state management
- Damage calculation algorithm (base + speed + efficiency bonuses)
- Spell system with cooldowns and effects
- HP tracking and battle resolution
- Real-time battle state updates

**Integration Steps**:
1. Integrate with Socket.io for real-time updates
2. Connect to Redis for battle state persistence
3. Implement spell cooldown tracking
4. Add damage animation triggers for UI

### 4. Battle UI Components ✅
**Location**: `/apps/web/src/components/battle/BattleArena.tsx`

**Features**:
- Split-pane layout (problem description + code editor)
- Real-time HP bars with color coding
- Battle timer with countdown
- CodeMirror integration with multiple languages
- Spell casting interface with cooldowns
- Live output panel with test results
- Damage feed and battle status

**Integration Steps**:
1. Install required UI dependencies: `@uiw/react-codemirror`, `lucide-react`
2. Set up Tailwind CSS with dark theme
3. Configure shadcn/ui components
4. Connect to Socket.io client for real-time updates
5. Implement spell casting animations

## Required Dependencies

### Backend Dependencies
```json
{
  "zx": "^7.2.3",
  "@trpc/server": "^10.45.1",
  "redis": "^4.6.0",
  "socket.io": "^4.7.0",
  "dockerode": "^3.3.0"
}
```

### Frontend Dependencies
```json
{
  "@uiw/react-codemirror": "^4.21.24",
  "@uiw/codemirror-extensions-langs": "^4.21.24",
  "@uiw/codemirror-theme-dracula": "^4.21.24",
  "lucide-react": "^0.344.0",
  "react-markdown": "^9.0.1",
  "remark-gfm": "^4.0.0"
}
```

## Docker Setup

### Code Runner Image
```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    python3 \
    openjdk-17-jdk \
    gcc \
    g++ \
    mono-complete \
    rustc \
    cargo \
    golang \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
```

### Build and Run
```bash
docker build -t code-runner .
docker run --network none --name battle-exec-1 --rm -i -d -v ./temp:/app/ code-runner
```

## Database Schema Updates

### Users Collection
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String, // bcrypt hash
  elo: Number,
  wins: Number,
  losses: Number,
  spells: [String], // unlocked spell IDs
  rank: String, // Stone to Grandmaster
  seasonRank: String,
  battleHistory: [ObjectId],
  friends: [String],
  onlineStatus: Boolean,
  lastActive: Date
}
```

### Battles Collection
```javascript
{
  _id: ObjectId,
  player1: ObjectId,
  player2: ObjectId,
  puzzle: String,
  status: String, // WAITING, COUNTDOWN, ACTIVE, JUDGING, ENDED
  startTime: Date,
  endTime: Date,
  timeLimit: Number,
  submissions: [Submission],
  spells: [ActiveSpell],
  winner: ObjectId
}
```

### Puzzles Collection
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  difficulty: Number, // 1-5
  eloRange: [Number],
  testCases: [TestCase],
  hiddenTestCases: [TestCase],
  timeLimit: Number,
  memoryLimit: Number,
  languages: [String],
  tags: [String],
  benchmarks: [Benchmark]
}
```

## Socket.io Events

### Client → Server
- `matchmaking:join` - Enter matchmaking queue
- `matchmaking:leave` - Leave matchmaking queue
- `battle:submit` - Submit code solution
- `battle:spell_cast` - Cast a spell
- `battle:ready` - Mark as ready for battle
- `battle:leave` - Leave current battle

### Server → Client
- `matchmaking:found` - Match found, showing opponent info
- `battle:start` - Battle begins
- `battle:submission_result` - Code execution results
- `battle:damage` - Opponent took damage
- `battle:spell_cast` - Spell cast notification
- `battle:hp_update` - HP bar updates
- `battle:end` - Battle finished with winner

## Redis Data Structures

### Matchmaking Queue
```
matchmaking:queue:{elo_range} -> Set of user IDs
matchmaking:user:{user_id} -> User metadata
```

### Battle States
```
battle:{battle_id} -> Battle state object
battle:{battle_id}:submissions -> List of submissions
battle:{battle_id}:spells -> Active spells with cooldowns
```

### Leaderboards
```
leaderboard:season:{season_id} -> Sorted set (ELO)
leaderboard:weekly -> Sorted set (weekly ELO)
leaderboard:all_time -> Sorted set (all-time ELO)
```

## Implementation Priority

### Phase 1: Core Infrastructure (Week 1-2)
1. Set up Docker code execution environment
2. Implement puzzle management system
3. Create basic battle service
4. Set up Socket.io real-time communication

### Phase 2: Battle System (Week 3-4)
1. Implement damage calculation algorithm
2. Add spell system with cooldowns
3. Create battle UI components
4. Integrate real-time HP updates

### Phase 3: Matchmaking & Social (Week 5-6)
1. Implement Redis-based matchmaking
2. Add ELO-based pairing logic
3. Create friends and spectator system
4. Implement leaderboards and seasons

### Phase 4: Polish & Production (Week 7-8)
1. Add battle animations and effects
2. Implement comprehensive testing
3. Set up production deployment
4. Add monitoring and analytics

## Migration from Lootcode

### Direct Adaptations
- **Code Execution**: Nearly identical, just adapt interface
- **Problem Format**: Can use same markdown + test case structure
- **Battle Mechanics**: Adapt combat formulas for 1v1 focus
- **UI Components**: Modify for competitive battle theme

### Theme Adaptations
- Change fantasy RPG theme to cyberpunk arena theme
- Replace "enemies" with "opponents"
- Change "gold/rewards" to "ELO points"
- Adapt spell names to fit tech/glitch theme

### New Features Needed
- Real-time 1v1 synchronization
- Spectator mode with multiple viewers
- Private match rooms with codes
- Season-based ranking system

## Testing Strategy

### Unit Tests
- Code execution pipeline
- Damage calculation algorithms
- Spell cooldown logic
- Puzzle loading and caching

### Integration Tests
- End-to-end battle flow
- Matchmaking queue behavior
- Socket.io event handling
- Redis data persistence

### Load Tests
- Concurrent battle sessions
- Code execution performance
- Redis throughput under load
- Socket.io connection limits

## Performance Considerations

### Code Execution
- Container pooling to reduce startup time
- Resource limits per execution
- Cleanup strategies for temporary files
- Monitoring for zombie containers

### Real-time Features
- Redis pub/sub for battle state updates
- Socket.io adapter for horizontal scaling
- Efficient battle state serialization
- Rate limiting on submissions

### Caching Strategy
- Puzzle content caching
- User session caching
- Leaderboard caching with TTL
- Battle state persistence

## Security Considerations

### Code Execution
- Docker container isolation
- Network restrictions (no internet access)
- File system permissions
- Resource limits (CPU, memory, time)

### Battle System
- Input validation on all submissions
- Rate limiting on spell casting
- Anti-cheat measures for code plagiarism
- Secure WebSocket connections

This integration plan provides a comprehensive roadmap for leveraging Lootcode's proven components while building your competitive coding battle arena.
