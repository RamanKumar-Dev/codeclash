import { describe, it, expect, beforeEach } from '@jest/globals';
import { EloService } from '../src/services/eloService';

// Mock PrismaClient
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  match: {
    findMany: jest.fn(),
  },
};

describe('EloService', () => {
  let eloService: EloService;

  beforeEach(() => {
    eloService = new EloService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('updateEloAfterBattle', () => {
    it('should correctly update ELO for winner and loser', async () => {
      const battleResult = {
        roomId: 'room1',
        winnerId: 'user1',
        loserId: 'user2',
        endTime: new Date(),
        reason: 'hp_depleted' as const,
        battleDuration: 300,
        totalSubmissions: 5,
        averageAccuracy: 0.8,
      };

      // Mock user data
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user1',
          username: 'Player1',
          rank: 1200,
        })
        .mockResolvedValueOnce({
          id: 'user2',
          username: 'Player2',
          rank: 1200,
        });

      // Mock update calls
      mockPrisma.user.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await eloService.updateEloAfterBattle(battleResult);

      expect(result.winnerId).toBe('user1');
      expect(result.loserId).toBe('user2');
      expect(result.winnerOldElo).toBe(1200);
      expect(result.loserOldElo).toBe(1200);
      expect(result.winnerEloChange).toBe(16); // Expected: 32 * (1 - 0.5) = 16
      expect(result.loserEloChange).toBe(-16);
      expect(result.winnerNewElo).toBe(1216);
      expect(result.loserNewElo).toBe(1184);
    });

    it('should handle ELO difference correctly', async () => {
      const battleResult = {
        roomId: 'room1',
        winnerId: 'user1',
        loserId: 'user2',
        endTime: new Date(),
        reason: 'hp_depleted' as const,
        battleDuration: 300,
        totalSubmissions: 5,
        averageAccuracy: 0.8,
      };

      // Higher rated player wins
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user1',
          username: 'Player1',
          rank: 1400,
        })
        .mockResolvedValueOnce({
          id: 'user2',
          username: 'Player2',
          rank: 1200,
        });

      mockPrisma.user.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await eloService.updateEloAfterBattle(battleResult);

      // Higher rated player should gain less ELO
      expect(result.winnerEloChange).toBeLessThan(16);
      expect(result.loserEloChange).toBeGreaterThan(-16);
    });

    it('should handle upset victories correctly', async () => {
      const battleResult = {
        roomId: 'room1',
        winnerId: 'user1',
        loserId: 'user2',
        endTime: new Date(),
        reason: 'hp_depleted' as const,
        battleDuration: 300,
        totalSubmissions: 5,
        averageAccuracy: 0.8,
      };

      // Lower rated player wins (upset)
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user1',
          username: 'Player1',
          rank: 1200,
        })
        .mockResolvedValueOnce({
          id: 'user2',
          username: 'Player2',
          rank: 1400,
        });

      mockPrisma.user.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await eloService.updateEloAfterBattle(battleResult);

      // Lower rated player should gain more ELO for upset
      expect(result.winnerEloChange).toBeGreaterThan(16);
      expect(result.loserEloChange).toBeLessThan(-16);
    });

    it('should throw error if user not found', async () => {
      const battleResult = {
        roomId: 'room1',
        winnerId: 'user1',
        loserId: 'user2',
        endTime: new Date(),
        reason: 'hp_depleted' as const,
        battleDuration: 300,
        totalSubmissions: 5,
        averageAccuracy: 0.8,
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(eloService.updateEloAfterBattle(battleResult)).rejects.toThrow('User not found');
    });
  });

  describe('updateEloAfterDraw', () => {
    it('should correctly update ELO for draw', async () => {
      // Mock user data
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user1',
          username: 'Player1',
          rank: 1200,
        })
        .mockResolvedValueOnce({
          id: 'user2',
          username: 'Player2',
          rank: 1200,
        });

      mockPrisma.user.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const [result1, result2] = await eloService.updateEloAfterDraw('user1', 'user2');

      expect(result1.winnerId).toBe('user1');
      expect(result1.loserId).toBe('user2');
      expect(result1.actualScore).toBe(0.5);
      expect(result2.actualScore).toBe(0.5);
      
      // In a draw, both players should have opposite ELO changes
      expect(result1.winnerEloChange).toBe(-result2.winnerEloChange);
    });
  });

  describe('calculateExpectedScore', () => {
    it('should calculate expected score correctly', () => {
      // Test equal ELO
      const expected1 = eloService['calculateExpectedScore'](1200, 1200);
      expect(expected1).toBe(0.5);

      // Test higher rated player
      const expected2 = eloService['calculateExpectedScore'](1400, 1200);
      expect(expected2).toBeGreaterThan(0.5);
      expect(expected2).toBeLessThan(1);

      // Test lower rated player
      const expected3 = eloService['calculateExpectedScore'](1200, 1400);
      expect(expected3).toBeLessThan(0.5);
      expect(expected3).toBeGreaterThan(0);
    });
  });

  describe('getUserEloHistory', () => {
    it('should return user match history', async () => {
      const mockMatches = [
        {
          id: 'match1',
          player1Id: 'user1',
          player2Id: 'user2',
          status: 'COMPLETED',
          winnerId: 'user1',
          endedAt: new Date(),
          player1: { username: 'Player1', rank: 1200 },
          player2: { username: 'Player2', rank: 1150 },
        },
      ];

      mockPrisma.match.findMany.mockResolvedValue(mockMatches);

      const history = await eloService.getUserEloHistory('user1', 10);

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        matchId: 'match1',
        opponent: 'Player2',
        opponentElo: 1150,
        playerElo: 1200,
        result: 'win',
      });
    });
  });

  describe('getLeaderboard', () => {
    it('should return sorted leaderboard', async () => {
      const mockUsers = [
        { id: 'user1', username: 'Player1', rank: 1400, wins: 10, losses: 2 },
        { id: 'user2', username: 'Player2', rank: 1200, wins: 5, losses: 3 },
        { id: 'user3', username: 'Player3', rank: 1000, wins: 2, losses: 5 },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const leaderboard = await eloService.getLeaderboard(10);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0]).toMatchObject({
        rank: 1,
        username: 'Player1',
        elo: 1400,
        wins: 10,
        losses: 2,
        totalGames: 12,
        winRate: 83.33,
      });
    });
  });

  describe('getEloDistribution', () => {
    it('should return ELO distribution', async () => {
      const mockUsers = [
        { rank: 800 },
        { rank: 950 },
        { rank: 1100 },
        { rank: 1250 },
        { rank: 1400 },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const distribution = await eloService.getEloDistribution();

      expect(distribution).toMatchObject({
        '0-1000': 2,
        '1000-1200': 1,
        '1200-1400': 1,
        '1400-1600': 1,
        '1600-1800': 0,
        '1800-2000': 0,
        '2000+': 0,
      });
    });
  });

  describe('validateEloRange', () => {
    it('should validate ELO range', () => {
      expect(eloService.validateEloRange(1000)).toBe(true);
      expect(eloService.validateEloRange(0)).toBe(true);
      expect(eloService.validateEloRange(5000)).toBe(true);
      expect(eloService.validateEloRange(-1)).toBe(false);
      expect(eloService.validateEloRange(5001)).toBe(false);
    });
  });

  describe('simulateEloChange', () => {
    it('should simulate ELO change correctly', async () => {
      const change = await eloService.simulateEloChange(1200, 1200, true);
      expect(change).toBe(16); // 32 * (1 - 0.5)

      const loss = await eloService.simulateEloChange(1200, 1200, false);
      expect(loss).toBe(-16); // 32 * (0 - 0.5)
    });
  });
});
