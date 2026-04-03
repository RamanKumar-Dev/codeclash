# CodeClash ELO Rating and Seasonal Ranking System

## ELO Rating Formula

The ELO rating system uses the following formula to calculate rating changes after each battle:

```
New Rating = Old Rating + K × (Actual Score - Expected Score)
```

Where:
- **K-factor**: 32 (determines how much ratings change after each battle)
- **Actual Score**: 1 for win, 0.5 for draw, 0 for loss
- **Expected Score**: Calculated based on rating difference between players

### Expected Score Calculation

```
Expected Score = 1 / (1 + 10^((Opponent Rating - Player Rating) / 400))
```

## Example Calculation

**Scenario**: Player A (1500 ELO) vs Player B (1600 ELO), Player A wins

1. **Expected Score for Player A**:
   ```
   Expected Score = 1 / (1 + 10^((1600 - 1500) / 400))
   Expected Score = 1 / (1 + 10^(100/400))
   Expected Score = 1 / (1 + 10^0.25)
   Expected Score = 1 / (1 + 1.78)
   Expected Score = 0.36
   ```

2. **Rating Change for Player A**:
   ```
   New Rating = 1500 + 32 × (1 - 0.36)
   New Rating = 1500 + 32 × 0.64
   New Rating = 1500 + 20.48
   New Rating = 1520.48
   ```

3. **Rating Change for Player B**:
   ```
   New Rating = 1600 + 32 × (0 - 0.64)
   New Rating = 1600 - 20.48
   New Rating = 1579.52
   ```

## Rank Tiers

The ranking system includes the following tiers:

| Tier | ELO Range | Title |
|------|-----------|-------|
| Bronze | 0-1199 | Bronze Coder |
| Silver | 1200-1399 | Silver Coder |
| Gold | 1400-1599 | Gold Coder |
| Platinum | 1600-1799 | Platinum Coder |
| Diamond | 1800-1999 | Diamond Coder |
| Master | 2000+ | Master Coder |

## Post-Battle Actions

After each battle, the system performs the following actions:

1. **Update ELO Ratings**: Apply the ELO formula to both players
2. **Update Rank Tiers**: Check if players have moved to a new tier
3. **Update Seasonal Stats**: Increment wins/losses for the current season
4. **Update Leaderboards**: Refresh global and seasonal leaderboards
5. **Check for Rank Up/Down**: Notify players of tier changes

## Seasonal System

### Season Duration
- **Length**: 3 months per season
- **Reset**: At the end of each season, player ratings are partially reset

### Seasonal Reset Formula
```
New Season Rating = (Previous Season Rating × 0.7) + 1200
```

### Seasonal Rewards
- **Participation**: All active players receive base rewards
- **Tier Rewards**: Higher tiers receive better rewards
- **Top Players**: Additional rewards for top 100 players

## Leaderboard Queries

### Global Leaderboard
- **Query**: Get all players sorted by current ELO rating
- **Update**: Real-time updates after each battle
- **Display**: Shows rank, player name, ELO, and tier

### Seasonal Leaderboard
- **Query**: Get all players sorted by seasonal ELO rating
- **Update**: Real-time updates after each battle
- **Display**: Shows rank, player name, seasonal ELO, and tier
- **Reset**: Clears at the start of each new season

## Protection Against ELO Farming

To prevent players from manipulating the rating system:

### Rate Limiting
- **Minimum Wait**: 5 minutes between battles against the same opponent
- **Daily Limit**: Maximum of 20 battles per day per player

### Rating Decay
- **Inactivity Penalty**: -25 ELO per week of inactivity
- **Minimum Rating**: Players cannot drop below 800 ELO
- **Decay Cap**: Maximum decay of 200 ELO per season

### Matchmaking Restrictions
- **Rating Difference**: Maximum 400 ELO difference between matched players
- **Tier Restrictions**: Players can only battle within 2 tiers of their own tier
- **New Player Protection**: New accounts (first 10 battles) have restricted matchmaking

### Fraud Detection
- **Unusual Patterns**: Monitor for suspicious battle patterns
- **Report System**: Players can report suspected ELO farming
- **Penalties**: Account suspension or rating rollback for confirmed violations

## Implementation Notes

### Database Schema
- Store both current ELO and seasonal ELO separately
- Track battle history for fraud detection
- Maintain seasonal statistics for rewards calculation

### Performance Considerations
- Cache leaderboard data to reduce database load
- Update leaderboards asynchronously after battles
- Use efficient indexing for rating-based queries

### API Endpoints
- `GET /leaderboard/global` - Get global leaderboard
- `GET /leaderboard/seasonal` - Get seasonal leaderboard
- `POST /battle/result` - Submit battle results for ELO calculation
- `GET /player/{id}/stats` - Get player statistics and ranking
