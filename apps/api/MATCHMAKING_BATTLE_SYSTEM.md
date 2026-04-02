# Matchmaking and Battle System Documentation

## Overview

This document describes the complete matchmaking queue and real-time battle room system implemented using Socket.io and Redis for the Code-Clash competitive coding platform.

## Architecture

### Components

1. **MatchmakingService** - Handles player queuing and match creation
2. **BattleService** - Manages real-time battles and state machine
3. **Redis** - Stores queue data and battle states
4. **PostgreSQL** - Persistent match and player data
5. **Socket.io** - Real-time communication

### Flow

```
Player joins queue → Matchmaking finds opponent → Battle room created → Real-time battle → Winner determined
```

## Matchmaking Service

### Queue Management

**Redis Data Structures:**
- `matchmaking:queue` - Sorted set (ELO as score, userId as value)
- `player:{userId}` - Hash with player metadata
- TTL: 30 minutes on all player data

**ELO Matching Algorithm:**
- Initial window: ±200 ELO
- Expansion: +50 ELO every 10 seconds
- Processing: Every 2 seconds

### API Events

#### Client → Server

```typescript
// Join matchmaking queue
socket.emit('queue:join', { userId: string, elo: number });

// Leave queue
socket.emit('queue:leave');

// Get queue status
socket.emit('queue:status');
```

#### Server → Client

```typescript
// Successfully joined queue
socket.emit('queue:joined', { queueSize: number });

// Left queue
socket.emit('queue:left');

// Queue size updated
io.emit('queue:size_update', { size: number });

// Queue status response
socket.emit('queue:status_response', { queueSize: number, isInQueue: boolean });
```

## Battle Room System

### State Machine

```
WAITING → COUNTDOWN (3s) → ACTIVE → JUDGING → ENDED
```

### Redis Battle Storage

**Key:** `battle:{roomId}`
**Fields:**
- `player1Hp` - Player 1 health points
- `player2Hp` - Player 2 health points
- `player1Submissions` - Submission count
- `player2Submissions` - Submission count
- `player1LinesChanged` - Code changes metric
- `player2LinesChanged` - Code changes metric
- `status` - Current battle state
- `startTime` - Battle start timestamp
- `timeLimit` - Battle duration in seconds
- `player1Disconnected` - Disconnection flag
- `player2Disconnected` - Disconnection flag

**TTL:** 30 minutes

### Battle Events

#### Client → Server

```typescript
// Ready for battle
socket.emit('battle:ready', { roomId: string });

// Submit code
socket.emit('battle:submit', { 
  code: string, 
  language: string, 
  roomId: string 
});

// Cast spell
socket.emit('battle:spell_cast', { 
  spellType: SpellType, 
  roomId: string 
});

// Forfeit battle
socket.emit('battle:forfeit', { roomId: string });

// Join/leave room
socket.emit('join_room', { roomId: string });
socket.emit('leave_room', { roomId: string });
```

#### Server → Client

```typescript
// Match found
socket.emit('match:found', {
  roomId: string,
  opponent: { id: string, username: string, elo: number },
  puzzle: PuzzleData
});

// Battle countdown
socket.emit('battle:countdown', { countdown: number });

// Battle starts
socket.emit('battle:start', {
  puzzle: PuzzleData,
  timeLimit: number,
  opponentName: string,
  opponentElo: number
});

// Opponent progress (privacy-focused)
socket.emit('battle:opponent_progress', {
  linesChanged: number,
  submissionCount: number
});

// Damage dealt
socket.emit('battle:damage', {
  sourcePlayer: string,
  damage: number,
  targetHP: number,
  attackAnimation: string
});

// Spell used
socket.emit('battle:spell_used', {
  caster: string,
  spellType: SpellType,
  effect: any
});

// Time warning
socket.emit('battle:time_warning', { secondsLeft: 60 });

// Battle ends
socket.emit('battle:end', {
  winner: string,
  loser: string,
  damageLog: DamageLog[],
  eloChange: { winner: number, loser: number },
  rewards: { winner: any, loser: any }
});

// Reconnection events
socket.emit('battle:opponent_disconnected');
socket.emit('battle:reconnecting', { playerId: string });
```

## Spell System

### Spell Types

- **HEAL** - Restore 20 HP to caster
- **DAMAGE** - Deal 15 damage to opponent
- **TIME_FREEZE** - Add 30 seconds to battle timer
- **SHIELD** - Reduce next damage by 50%
- **HINT** - Get puzzle hint (existing)
- **SLOW** - Slow opponent (existing)

### Spell Usage Tracking

Each player has limited spell uses stored in the database:
```sql
SELECT uses_remaining FROM spells WHERE user_id = ? AND type = ?;
```

## Reconnection Handling

### Process

1. Player disconnects → Mark as disconnected in Redis
2. Notify opponent → `battle:opponent_disconnected`
3. Start 30-second timer
4. If player reconnects:
   - Restore battle state
   - Notify opponent → `battle:reconnecting`
5. If timeout expires → End battle, opponent wins

### Implementation

```typescript
// Mark disconnection
await redis.hSet(`battle:${roomId}`, {
  [`${playerField}Disconnected`]: 'true'
});

// Reconnection check
if (battleState.player1Disconnected || battleState.player2Disconnected) {
  await this.handleReconnection(roomId, userId, socket);
}
```

## Puzzle Selection

### Difficulty Mapping

- **ELO < 1100** → EASY puzzles
- **ELO 1100-1400** → MEDIUM puzzles  
- **ELO > 1400** → HARD puzzles

### Selection Process

1. Calculate average ELO of both players
2. Determine difficulty band
3. Fetch random puzzle from that difficulty
4. Include puzzle data in match found event

## Database Schema Updates

### Enhanced Match Model

```sql
ALTER TABLE matches ADD COLUMN time_limit INTEGER DEFAULT 300;
ALTER TABLE matches ADD COLUMN player1_hp INTEGER DEFAULT 100;
ALTER TABLE matches ADD COLUMN player2_hp INTEGER DEFAULT 100;
```

### New BattleSpell Model

```sql
CREATE TABLE battle_spells (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  caster_id TEXT NOT NULL,
  target_id TEXT,
  spell_type TEXT NOT NULL,
  effect JSONB,
  cast_at TIMESTAMP DEFAULT NOW()
);
```

## Performance Considerations

### Redis Optimization

- Use sorted sets for efficient ELO-based matching
- Set appropriate TTLs to prevent memory leaks
- Batch operations where possible

### Socket.io Scaling

- Use Redis adapter for multi-server scaling
- Implement connection limits
- Monitor memory usage per connection

### Database Indexing

```sql
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_players ON matches(player1_id, player2_id);
CREATE INDEX idx_battle_spells_match ON battle_spells(match_id);
```

## Testing

### Unit Tests

```bash
# Test matchmaking service
npm test -- matchmakingService.test.ts

# Test battle service  
npm test -- battleService.test.ts
```

### Integration Tests

```bash
# Test full battle flow
npm test -- battle-flow.integration.ts

# Test reconnection scenarios
npm test -- reconnection.integration.ts
```

### Load Testing

```bash
# Simulate 1000 concurrent players
npm run load-test --matchmaking

# Test battle room capacity
npm run load-test --battles
```

## Monitoring

### Key Metrics

- Queue size and wait times
- Battle duration and completion rates
- Reconnection success rate
- Spell usage patterns
- ELO distribution

### Health Checks

```typescript
// Service health
GET /health

// Queue status
GET /api/queue/status

// Active battles
GET /api/battles/active
```

## Configuration

### Environment Variables

```bash
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost/codeclash
MATCHMAKING_INTERVAL=2000
ELO_WINDOW_INITIAL=200
ELO_WINDOW_EXPANSION=50
BATTLE_TIME_LIMIT=300
RECONNECTION_TIMEOUT=30000
```

### Socket.io Configuration

```typescript
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN },
  maxHttpBufferSize: 1e6, // 1MB for code submissions
  pingTimeout: 60000,
  pingInterval: 25000
});
```

## Security Considerations

### Input Validation

- Validate all socket event data
- Sanitize code submissions
- Rate limit spell casting
- Verify user permissions

### Anti-Cheat Measures

- Monitor submission patterns
- Detect unusual spell usage
- Validate code execution time
- Implement replay system

## Deployment

### Docker Configuration

```yaml
services:
  api:
    environment:
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - redis
      - postgres
```

### Scaling

- Horizontal scaling with Redis adapter
- Database read replicas for leaderboards
- CDN for static puzzle content
- Load balancer for multiple API instances

## Troubleshooting

### Common Issues

1. **Players stuck in queue**
   - Check Redis connection
   - Verify matchmaking service is running
   - Check ELO matching logic

2. **Battle state corruption**
   - Clear Redis battle keys
   - Verify database consistency
   - Check for concurrent access

3. **Reconnection failures**
   - Verify socket mapping in Redis
   - Check TTL settings
   - Validate user authentication

### Debug Commands

```bash
# Check queue size
redis-cli ZCARD matchmaking:queue

# View battle state
redis-cli HGETALL battle:roomId

# Monitor socket connections
redis-cli KEYS user_sockets:*
```

## Future Enhancements

### Planned Features

- Tournament mode
- Spectator functionality
- Battle recordings/replays
- Advanced matching algorithms
- Guild/team battles
- Seasonal rankings

### Performance Improvements

- WebSocket compression
- Database connection pooling
- Redis clustering
- Edge computing for spell effects
