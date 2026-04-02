# Quick Setup Guide

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Redis and PostgreSQL running

## Installation

1. **Start Services with Docker**
```bash
docker-compose up -d
```

2. **Install Dependencies**
```bash
cd apps/api
npm install
```

3. **Database Setup**
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

4. **Start Development Server**
```bash
npm run dev
```

## Testing the System

### 1. Test Matchmaking

Connect two WebSocket clients:

```javascript
// Client 1
const socket1 = io('http://localhost:3001', {
  auth: { userId: 'user1', token: 'your-jwt-token' }
});

socket1.emit('queue:join', { elo: 1200 });

// Client 2  
const socket2 = io('http://localhost:3001', {
  auth: { userId: 'user2', token: 'your-jwt-token' }
});

socket2.emit('queue:join', { elo: 1250 });
```

### 2. Expected Events

Both clients should receive:
- `queue:joined` - Confirmation of queue entry
- `match:found` - When match is made
- `battle:countdown` - 3-second countdown
- `battle:start` - Battle begins

### 3. Battle Flow

```javascript
// When match found
socket.on('match:found', (data) => {
  console.log('Match found!', data);
  socket.emit('battle:ready', { roomId: data.roomId });
});

// During battle
socket.on('battle:start', (data) => {
  console.log('Battle started!', data);
  
  // Submit code
  socket.emit('battle:submit', {
    code: 'function solution() { return "hello"; }',
    language: 'javascript',
    roomId: data.roomId
  });
  
  // Cast spell
  socket.emit('battle:spell_cast', {
    spellType: 'DAMAGE',
    roomId: data.roomId
  });
});

// Battle end
socket.on('battle:end', (data) => {
  console.log('Battle ended!', data);
});
```

## Monitoring

### Redis Queue Status
```bash
redis-cli ZCARD matchmaking:queue
redis-cli ZRANGE matchmaking:queue 0 -1 WITHSCORES
```

### Battle State
```bash
redis-cli HGETALL battle:roomId
```

### Active Connections
```bash
redis-cli KEYS user_sockets:*
```

## Common Issues

### Port Conflicts
- Ensure ports 3001 (API), 5432 (PostgreSQL), 6379 (Redis) are available

### Connection Issues
- Check Redis connection: `redis-cli ping`
- Verify database connection: Check docker logs

### Matchmaking Not Working
- Verify matchmaking service started in logs
- Check Redis queue exists
- Ensure both clients are authenticated

## Environment Variables

Create `.env` file in `apps/api/`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/codeclash
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

## Production Deployment

1. **Build Docker Image**
```bash
docker build -t code-clash-api ./apps/api
```

2. **Update docker-compose.yml**
```yaml
services:
  api:
    image: code-clash-api:latest
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
```

3. **Deploy**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test-matchmaking.yml
```

Example `load-test-matchmaking.yml`:
```yaml
config:
  target: 'ws://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - engine: ws
    flow:
      - connect:
          target: '/socket.io/?EIO=4&transport=websocket'
      - send: '42["queue:join",{"elo":1200}]'
```
