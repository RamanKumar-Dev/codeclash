# Code Execution and Damage Calculation System

## Overview

This document describes the complete code execution and damage calculation system built with Judge0 CE integration for the Code-Clash competitive coding platform.

## Architecture

### Components

1. **Judge0Client** - Handles communication with Judge0 CE
2. **ExecutionService** - Orchestrates code execution and damage calculation
3. **DamageCalculator** - Implements the damage formula and battle mechanics
4. **EloService** - Manages ELO rating updates after battles
5. **Redis** - Stores battle state and damage events
6. **PostgreSQL** - Persistent data storage

### Flow

```
Code Submission → Judge0 Execution → Test Case Results → Damage Calculation → Battle State Update → ELO Update
```

## Judge0 CE Integration

### Configuration

```yaml
judge0:
  image: judge0/judge0:latest
  environment:
    - JUDGE0_MAINTENANCE_MODE=false
    - JUDGE0_E2E_TIMEOUT=20
    - JUDGE0_COMPILE_TIMEOUT=10
    - JUDGE0_RUN_TIMEOUT=5
    - JUDGE0_CPULIMIT_TIMEOUT=3
    - JUDGE0_MEMORY_LIMIT=256
    - JUDGE0_CPU_LIMIT=2
    - JUDGE0_MAX_CONCURRENT_RUNS=10
```

### Language Mapping

| Language | Judge0 ID | Aliases |
|-----------|-----------|---------|
| Python | 71 | python, py |
| JavaScript | 63 | javascript, js, ts |
| C++ | 54 | cpp, c++ |
| Java | 62 | java |
| Go | 60 | go |

### Execution Limits

- **CPU Time**: 2-3 seconds per test case
- **Memory**: 256MB
- **Wall Time**: 5 seconds
- **Output Size**: 1MB maximum

## Damage Calculation System

### Formula

```
Base damage per correct submission = 20 HP
Speed multiplier = max(0.5, 1 - (elapsedSeconds / timeLimitSeconds)) → range 0.5x to 1x
Efficiency bonus: if runtime_ms < p50_benchmark → +10 HP
All-test-case pass = +15 HP flat bonus
First-solve bonus = +25 HP

Total damage = (20 × passedRatio × speedMult) + efficiencyBonus + allPassBonus + firstSolveBonus
Cap per submission: 70 HP max
Partial credit: each test case pass = 2 HP
Starting HP: 500 each
```

### Damage Breakdown

```typescript
interface DamageCalculation {
  baseDamage: number;           // 20 × passedRatio
  speedMultiplier: number;      // 0.5 to 1.0 based on time
  efficiencyBonus: number;      // +10 if faster than p50 benchmark
  allPassBonus: number;         // +15 if all tests pass
  firstSolveBonus: number;       // +25 for first solve in battle
  totalDamage: number;          // Sum of all components
  partialDamage: number;        // 2 HP per passed test case
  cappedDamage: number;          // Final damage (max 70)
}
```

### Example Calculations

#### Example 1: Perfect Solution
- **Tests**: 10/10 passed
- **Time**: 60s / 300s limit
- **Runtime**: 500ms (p50: 800ms)
- **First solve**: Yes

```
Base damage: 20 × 1.0 = 20
Speed multiplier: max(0.5, 1 - 60/300) = 0.8
Base with speed: 20 × 0.8 = 16
Efficiency bonus: +10 (faster than p50)
All pass bonus: +15
First solve bonus: +25
Total: 16 + 10 + 15 + 25 = 66 HP
```

#### Example 2: Partial Solution
- **Tests**: 6/10 passed
- **Time**: 120s / 300s limit
- **Runtime**: 1200ms (p50: 800ms)
- **First solve**: No

```
Base damage: 20 × 0.6 = 12
Speed multiplier: max(0.5, 1 - 120/300) = 0.6
Base with speed: 12 × 0.6 = 7.2
Efficiency bonus: 0 (slower than p50)
All pass bonus: 0 (not all tests)
First solve bonus: 0
Partial damage: 6 × 2 = 12
Total: max(7.2, 12) = 12 HP
```

## API Endpoints

### POST /api/execute

**Request:**
```json
{
  "code": "function solution() { return 'hello'; }",
  "language": "javascript",
  "puzzleId": "puzzle-123",
  "userId": "user-456",
  "roomId": "battle-789",
  "submissionId": "sub-000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "damage": 45,
    "opponentHp": 455,
    "isBattleOver": false,
    "executionResult": {
      "passed": 8,
      "total": 10,
      "runtime_ms": 650,
      "memory_kb": 128,
      "statusCode": 3,
      "statusDescription": "Success",
      "correctnessRatio": 0.8
    },
    "damageBreakdown": {
      "baseDamage": 16.0,
      "speedMultiplier": 0.85,
      "efficiencyBonus": 10,
      "allPassBonus": 0,
      "firstSolveBonus": 0,
      "totalDamage": 26.0,
      "partialDamage": 16,
      "cappedDamage": 45
    }
  }
}
```

### GET /api/history/:userId

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sub-001",
      "problemTitle": "Two Sum",
      "difficulty": "EASY",
      "language": "python",
      "passedTests": 10,
      "totalTests": 10,
      "runtimeMs": 450,
      "damageDealt": 65,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### GET /api/health

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "judge0": true,
    "database": true,
    "redis": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Battle State Management

### Redis Structure

**Battle State:** `battle:{roomId}`
```json
{
  "player1Hp": "450",
  "player2Hp": "380",
  "player1Submissions": "3",
  "player2Submissions": "2",
  "player1LinesChanged": "45",
  "player2LinesChanged": "32",
  "status": "ACTIVE",
  "startTime": "1642248600000",
  "timeLimit": "300"
}
```

**Damage Event:** `battle:{roomId}:damage_event`
```json
{
  "userId": "user-123",
  "damage": 45,
  "opponentHp": 355,
  "executionResult": {
    "passed": 8,
    "total": 10,
    "runtime_ms": 650
  },
  "damageBreakdown": {
    "cappedDamage": 45
  },
  "isBattleOver": false,
  "timestamp": 1642248900000
}
```

**First Solve Tracking:** `battle:{roomId}:first_solve`
```
user-456
```

## ELO System

### Formula

```
K-factor = 32
Expected score = 1 / (1 + 10^((opponentElo - playerElo)/400))
New ELO = oldElo + K × (actualScore - expectedScore)
```

### ELO Update Process

1. **Battle ends** with winner/loser determined
2. **Fetch current ELO** ratings for both players
3. **Calculate expected scores** based on rating difference
4. **Apply ELO changes** using K-factor of 32
5. **Update database** with new ratings and win/loss counts

### Example ELO Calculation

**Player A:** 1200 ELO vs **Player B:** 1400 ELO
- Expected Score A: 1 / (1 + 10^((1400-1200)/400)) = 0.24
- Expected Score B: 1 / (1 + 10^((1200-1400)/400)) = 0.76

**If Player A wins:**
- Player A: 1200 + 32 × (1 - 0.24) = +24 ELO → 1224
- Player B: 1400 + 32 × (0 - 0.76) = -24 ELO → 1376

## Puzzle Benchmarks

### Benchmark System

- **p50_runtime_ms**: Median execution time across all successful submissions
- **Updated dynamically** as new solutions are submitted
- **Language-specific** benchmarks for each puzzle
- **Efficiency bonus** awarded for beating the p50 benchmark

### Benchmark Update Formula

```
new_p50 = ((old_p50 × sample_size) + new_runtime) / (sample_size + 1)
```

## Performance Considerations

### Judge0 Optimization

- **Batch submissions** for multiple test cases
- **Polling optimization** with 500ms intervals
- **Timeout handling** with maximum 10 attempts
- **Connection pooling** for concurrent executions

### Redis Optimization

- **TTL management** for battle states (30 minutes)
- **Efficient data structures** using hashes
- **Atomic operations** for HP updates
- **Event-driven updates** for battle damage

### Database Optimization

- **Indexing** on user ELO ratings and match history
- **Batch operations** for ELO updates
- **Connection pooling** for high concurrency
- **Async operations** for non-blocking execution

## Security Considerations

### Code Execution Security

- **Sandboxed environment** using Docker containers
- **Resource limits** enforced by Judge0
- **Timeout protection** for infinite loops
- **Memory restrictions** to prevent abuse

### Input Validation

- **Code size limits** (100KB maximum)
- **Language validation** against supported list
- **Request rate limiting** (100 requests per minute)
- **Syntax validation** before execution

### Data Protection

- **No code storage** in logs after execution
- **Sanitized output** to prevent injection
- **Isolated execution** environments
- **Secure communication** between services

## Monitoring and Metrics

### Key Performance Indicators

- **Execution time** per submission
- **Judge0 queue length** and wait times
- **Success rate** of code executions
- **Average damage dealt** per submission
- **Battle duration** statistics

### Health Checks

```bash
# Judge service health
curl http://localhost:3002/api/health

# Judge0 CE status
curl http://localhost:2358/system

# Redis connection
redis-cli ping

# Database connectivity
docker exec postgres pg_isready
```

### Logging

- **Execution results** with timing information
- **Error tracking** for failed submissions
- **Performance metrics** for optimization
- **Security events** and suspicious activities

## Testing

### Unit Tests

```bash
# Test damage calculation
npm test -- damageCalculator.test.ts

# Test ELO calculations
npm test -- eloService.test.ts

# Test Judge0 client
npm test -- judge0Client.test.ts
```

### Integration Tests

```bash
# Test full execution flow
npm test -- execution-flow.integration.ts

# Test battle scenarios
npm test -- battle-scenarios.integration.ts

# Test ELO updates
npm test -- elo-updates.integration.ts
```

### Load Testing

```bash
# Concurrent execution test
npm run load-test --execution

# Battle simulation
npm run load-test --battles

# ELO calculation stress test
npm run load-test --elo
```

## Troubleshooting

### Common Issues

1. **Judge0 timeouts**
   - Check resource limits
   - Verify code complexity
   - Monitor queue length

2. **Incorrect damage calculation**
   - Verify puzzle benchmarks
   - Check time calculations
   - Validate formula implementation

3. **ELO inconsistencies**
   - Review battle results
   - Check calculation formulas
   - Verify database updates

4. **Redis state corruption**
   - Clear battle keys
   - Verify data consistency
   - Check TTL settings

### Debug Commands

```bash
# Check Judge0 submissions
curl http://localhost:2358/submissions

# View battle state
redis-cli HGETALL battle:roomId

# Monitor damage events
redis-cli KEYS "battle:*:damage_event"

# Check puzzle benchmarks
psql "SELECT * FROM puzzle_benchmarks WHERE puzzle_id = 'puzzle-123';"
```

## Future Enhancements

### Planned Features

- **Advanced language support** (Rust, C#, etc.)
- **Custom damage formulas** per puzzle type
- **Real-time execution monitoring**
- **Code similarity detection**
- **Performance analytics dashboard**

### Performance Improvements

- **Judge0 clustering** for horizontal scaling
- **Redis clustering** for high availability
- **Database read replicas** for analytics
- **Edge caching** for frequently accessed data

### Security Enhancements

- **Advanced sandboxing** with additional restrictions
- **Code pattern analysis** for malicious detection
- **Rate limiting per user** and per puzzle
- **Audit logging** for compliance
