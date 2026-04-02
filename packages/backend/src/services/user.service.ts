import { User } from '@code-clash/shared-types';

// Mock user service - replace with actual database implementation
export class UserService {
  private users: Map<string, User> = new Map();

  async getUserById(userId: string): Promise<User | null> {
    // Mock implementation - replace with database lookup
    const mockUser: User = {
      id: userId,
      username: 'TestUser',
      email: 'test@example.com',
      xp: 1000,
      rank: 5,
      tokens: 100,
      elo: 1200,
      battlesWon: 8,
      battlesLost: 3,
      spellsUnlocked: ['oracle_hint'], // Example: already has oracle hint
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return mockUser;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(userId, updatedUser);
    
    return updatedUser;
  }

  async incrementBattleStats(userId: string, won: boolean): Promise<User | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const updates: Partial<User> = {
      battlesWon: won ? user.battlesWon + 1 : user.battlesWon,
      battlesLost: !won ? user.battlesLost + 1 : user.battlesLost,
      updatedAt: new Date()
    };

    return this.updateUser(userId, updates);
  }

  async updateElo(userId: string, newElo: number): Promise<User | null> {
    return this.updateUser(userId, { elo: newElo });
  }
}

export const userService = new UserService();
