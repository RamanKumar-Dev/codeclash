# Quick Start Guide

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git

## Installation

### 1. Clone and Setup

```bash
git clone <repository-url>
cd code-clash
```

### 2. Start Services

```bash
# Start all services (PostgreSQL, Redis, Judge0, API, Judge, Web)
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Initialize Database

```bash
# Enter API container
docker-compose exec api bash

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### 4. Verify Services

```bash
# API Health
curl http://localhost:3001/health

# Judge Service Health
curl http://localhost:3002/api/health

# Judge0 CE Status
curl http://localhost:2358/system
```

## Testing the System

### 1. Test Code Execution

```bash
curl -X POST http://localhost:3002/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function solution() { return \"hello world\"; }",
    "language": "javascript",
    "puzzleId": "test-puzzle-1",
    "userId": "test-user-1",
    "roomId": "test-battle-1"
  }'
```

### 2. Expected Response

```json
{
  "success": true,
  "data": {
    "damage": 25,
    "opponentHp": 475,
    "isBattleOver": false,
    "executionResult": {
      "passed": 1,
      "total": 1,
      "runtime_ms": 45,
      "memory_kb": 64,
      "statusCode": 3,
      "statusDescription": "Success",
      "correctnessRatio": 1.0
    },
    "damageBreakdown": {
      "baseDamage": 20.0,
      "speedMultiplier": 0.95,
      "efficiencyBonus": 0,
      "allPassBonus": 15,
      "firstSolveBonus": 0,
      "totalDamage": 34.0,
      "partialDamage": 2,
      "cappedDamage": 25
    }
  }
}
```

### 3. Test Matchmaking and Battle Flow

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3001', {
  auth: { userId: 'test-user-1', token: 'test-token' }
});

// Join queue
socket.emit('queue:join', { elo: 1200 });

// Listen for match
socket.on('match:found', (data) => {
  console.log('Match found!', data);
  
  // Ready for battle
  socket.emit('battle:ready', { roomId: data.roomId });
  
  // Submit code when battle starts
  socket.on('battle:start', (battleData) => {
    socket.emit('battle:submit', {
      code: 'function solution() { return 42; }',
      language: 'javascript',
      roomId: battleData.roomId
    });
  });
});
```

## Supported Languages

| Language | ID | Example Code |
|----------|----|--------------|
| Python | 71 | `def solution(): return "hello"` |
| JavaScript | 63 | `function solution() { return "hello" }` |
| C++ | 54 | `string solution() { return "hello"; }` |
| Java | 62 | `public String solution() { return "hello"; }` |
| Go | 60 | `func solution() string { return "hello" }` |

## Damage Calculation Examples

### Perfect Solution (Max Damage: 70 HP)
```
Tests: 10/10 passed
Time: 30s / 300s limit
Runtime: 400ms (p50: 800ms)
First solve: Yes

Damage = (20 × 1.0 × 0.9) + 10 + 15 + 25 = 68 HP
```

### Partial Solution
```
Tests: 6/10 passed
Time: 120s / 300s limit
Runtime: 1200ms (p50: 800ms)
First solve: No

Damage = max((20 × 0.6 × 0.6), 6×2) = 12 HP
```

## Monitoring

### Health Checks

```bash
# All services health
curl http://localhost:3001/health && \
curl http://localhost:3002/api/health && \
curl http://localhost:2358/system

# Redis status
redis-cli ping

# PostgreSQL status
docker-compose exec postgres pg_isready
```

### Logs

```bash
# API logs
docker-compose logs -f api

# Judge service logs
docker-compose logs -f judge

# Judge0 logs
docker-compose logs -f judge0

# Redis logs
docker-compose logs -f redis
```

## Performance Testing

### Load Test Execution

```bash
# Install artillery
npm install -g artillery

# Run execution load test
artillery run load-test-execution.yml
```

Example `load-test-execution.yml`:
```yaml
config:
  target: 'http://localhost:3002'
  phases:
    - duration: 60
      arrivalRate: 5
scenarios:
  - flow:
      - post:
          url: '/api/execute'
          json:
            code: 'function solution() { return "test"; }'
            language: 'javascript'
            puzzleId: 'test-puzzle'
            userId: 'user-{{ $randomString() }}'
            roomId: 'room-{{ $randomString() }}'
```

## Troubleshooting

### Common Issues

1. **Judge0 not responding**
```bash
# Check Judge0 status
docker-compose logs judge0

# Restart Judge0
docker-compose restart judge0
```

2. **Database connection errors**
```bash
# Check PostgreSQL
docker-compose exec postgres psql -U postgres -d codeclash -c "SELECT 1;"

# Reset database
docker-compose down -v
docker-compose up -d postgres
docker-compose exec api npm run db:migrate
```

3. **Redis connection issues**
```bash
# Test Redis
docker-compose exec redis redis-cli ping

# Clear Redis data
docker-compose exec redis redis-cli FLUSHALL
```

4. **Execution timeouts**
```bash
# Check Judge0 configuration
curl http://localhost:2358/system

# Monitor Judge0 performance
docker-compose exec judge0 ps aux
```

### Debug Commands

```bash
# View battle state
redis-cli HGETALL battle:room-id

# Check puzzle benchmarks
psql "SELECT * FROM puzzle_benchmarks LIMIT 5;"

# Monitor submissions
psql "SELECT * FROM submissions ORDER BY created_at DESC LIMIT 5;"

# Check ELO ratings
psql "SELECT username, rank FROM users ORDER BY rank DESC LIMIT 10;"
```

## Configuration

### Environment Variables

Create `.env` files in each service directory:

**API Service** (`apps/api/.env`):
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/codeclash
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JUDGE0_URL=http://localhost:2358
```

**Judge Service** (`services/judge/.env`):
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/codeclash
REDIS_URL=redis://localhost:6379
JUDGE0_URL=http://localhost:2358
JUDGE0_API_URL=http://localhost:2358
```

### Performance Tuning

**Judge0 Configuration** (in `docker-compose.yml`):
```yaml
judge0:
  environment:
    - JUDGE0_MAX_CONCURRENT_RUNS=20
    - JUDGE0_CPU_LIMIT=4
    - JUDGE0_MEMORY_LIMIT=512
```

**Redis Configuration**:
```bash
# Increase memory limit
redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

## Development

### Local Development

```bash
# Start databases only
docker-compose up -d postgres redis judge0

# Start API locally
cd apps/api
npm install
npm run dev

# Start judge service locally
cd services/judge
npm install
npm run dev
```

### Running Tests

```bash
# API tests
cd apps/api
npm test

# Judge service tests
cd services/judge
npm test

# Integration tests
npm run test:integration
```

### Code Style

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## Production Deployment

### Docker Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale api=3 --scale judge=2
```

### Environment Setup

1. **Set production environment variables**
2. **Configure SSL certificates**
3. **Set up monitoring and logging**
4. **Configure backup strategies**
5. **Set up CI/CD pipeline**

### Monitoring Setup

```bash
# Install monitoring tools
docker-compose -f docker-compose.monitoring.yml up -d

# View metrics
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
```

## Support

### Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Judge System Guide](./CODE_EXECUTION_SYSTEM.md)
- [Matchmaking System](./MATCHMAKING_BATTLE_SYSTEM.md)

### Getting Help

1. Check logs for error messages
2. Review troubleshooting section
3. Check GitHub issues
4. Contact development team

### Contributing

1. Fork the repository
2. Create feature branch
3. Make changes and test
4. Submit pull request
5. Wait for review and merge
