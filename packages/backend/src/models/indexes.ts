import { connect } from 'mongoose';
import { logger } from '../utils/logger';

export class DatabaseIndexManager {
  static async createIndexes(): Promise<void> {
    try {
      const db = connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/codeclash');
      
      // User collection indexes
      await this.createUserIndexes();
      
      // Battle collection indexes
      await this.createBattleIndexes();
      
      // Puzzle collection indexes
      await this.createPuzzleIndexes();
      
      // Season collection indexes
      await this.createSeasonIndexes();
      
      // Leaderboard collection indexes (if using MongoDB for leaderboard)
      await this.createLeaderboardIndexes();
      
      // Spell collection indexes
      await this.createSpellIndexes();
      
      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Failed to create database indexes:', error);
      throw error;
    }
  }

  private static async createUserIndexes(): Promise<void> {
    const User = require('./user.model').default;
    
    // Performance indexes
    await User.collection.createIndex({ elo: -1 }); // For leaderboard queries
    await User.collection.createIndex({ username: 1 }, { unique: true }); // For user lookups
    await User.collection.createIndex({ email: 1 }, { unique: true }); // For authentication
    await User.collection.createIndex({ seasonalElo: -1 }); // For seasonal leaderboard
    await User.collection.createIndex({ createdAt: -1 }); // For recent users
    await User.collection.createIndex({ lastActiveAt: -1 }); // For active users
    
    // Compound indexes for complex queries
    await User.collection.createIndex({ elo: -1, battlesWon: -1 }); // Leaderboard with wins
    await User.collection.createIndex({ rankTier: 1, elo: -1 }); // Filter by rank tier
    await User.collection.createIndex({ isActive: 1, lastActiveAt: -1 }); // Active users by time
    
    logger.info('User indexes created');
  }

  private static async createBattleIndexes(): Promise<void> {
    const Battle = require('./battle.model').default;
    
    // Performance indexes
    await Battle.collection.createIndex({ battleId: 1 }, { unique: true }); // Battle lookups
    await Battle.collection.createIndex({ createdAt: -1 }); // Recent battles
    await Battle.collection.createIndex({ status: 1 }); // Filter by status
    await Battle.collection.createIndex({ puzzleId: 1 }); // Battles by puzzle
    await Battle.collection.createIndex({ 'participants.userId': 1 }); // User's battles
    
    // Compound indexes for complex queries
    await Battle.collection.createIndex({ status: 1, createdAt: -1 }); // Active battles by time
    await Battle.collection.createIndex({ 'participants.userId': 1, createdAt: -1 }); // User's battle history
    await Battle.collection.createIndex({ puzzleId: 1, createdAt: -1 }); // Puzzle battle history
    await Battle.collection.createIndex({ winnerId: 1, createdAt: -1 }); // Winner's battles
    
    // TTL indexes for automatic cleanup
    await Battle.collection.createIndex({ completedAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days
    
    logger.info('Battle indexes created');
  }

  private static async createPuzzleIndexes(): Promise<void> {
    const Puzzle = require('./puzzle.model').default;
    
    // Performance indexes
    await Puzzle.collection.createIndex({ title: 'text', description: 'text' }); // Full-text search
    await Puzzle.collection.createIndex({ difficulty: 1 }); // Filter by difficulty
    await Puzzle.collection.createIndex({ category: 1 }); // Filter by category
    await Puzzle.collection.createIndex({ isActive: 1 }); // Active puzzles
    await Puzzle.collection.createIndex({ createdAt: -1 }); // Recent puzzles
    await Puzzle.collection.createIndex({ playCount: -1 }); // Popular puzzles
    
    // Compound indexes for complex queries
    await Puzzle.collection.createIndex({ difficulty: 1, isActive: 1 }); // Active puzzles by difficulty
    await Puzzle.collection.createIndex({ category: 1, difficulty: 1 }); // Category + difficulty
    await Puzzle.collection.createIndex({ isActive: 1, playCount: -1 }); // Popular active puzzles
    await Puzzle.collection.createIndex({ createdBy: 1, createdAt: -1 }); // Creator's puzzles
    
    logger.info('Puzzle indexes created');
  }

  private static async createSeasonIndexes(): Promise<void> {
    const Season = require('./season.model').default;
    
    // Performance indexes
    await Season.collection.createIndex({ seasonId: 1 }, { unique: true }); // Season lookups
    await Season.collection.createIndex({ isActive: 1 }); // Active season
    await Season.collection.createIndex({ startDate: -1 }); // Recent seasons
    await Season.collection.createIndex({ endDate: -1 }); // End dates
    
    // Compound indexes for complex queries
    await Season.collection.createIndex({ isActive: 1, endDate: -1 }); // Active season with end date
    await Season.collection.createIndex({ 'topPlayers.userId': 1 }); // Top player lookups
    
    // TTL indexes for automatic cleanup
    await Season.collection.createIndex({ endDate: 1 }, { expireAfterSeconds: 7776000 }); // 90 days
    
    logger.info('Season indexes created');
  }

  private static async createLeaderboardIndexes(): Promise<void> {
    // If using MongoDB for leaderboard (alternative to Redis)
    const LeaderboardEntry = require('./leaderboard.model').default;
    
    if (LeaderboardEntry) {
      // Performance indexes
      await LeaderboardEntry.collection.createIndex({ type: 1, rank: 1 }); // Leaderboard by type and rank
      await LeaderboardEntry.collection.createIndex({ userId: 1, type: 1 }); // User's ranks
      await LeaderboardEntry.collection.createIndex({ updatedAt: -1 }); // Recent updates
      
      // Compound indexes for complex queries
      await LeaderboardEntry.collection.createIndex({ type: 1, rank: 1, updatedAt: -1 }); // Leaderboard with time
      
      // TTL indexes for automatic cleanup
      await LeaderboardEntry.collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 86400 }); // 24 hours
      
      logger.info('Leaderboard indexes created');
    }
  }

  private static async createSpellIndexes(): Promise<void> {
    const Spell = require('./spell.model').default;
    
    // Performance indexes
    await Spell.collection.createIndex({ spellId: 1 }, { unique: true }); // Spell lookups
    await Spell.collection.createIndex({ type: 1 }); // Filter by spell type
    await Spell.collection.createIndex({ rarity: 1 }); // Filter by rarity
    await Spell.collection.createIndex({ isActive: 1 }); // Active spells
    
    // Compound indexes for complex queries
    await Spell.collection.createIndex({ type: 1, rarity: 1 }); // Type + rarity
    await Spell.collection.createIndex({ isActive: 1, type: 1 }); // Active spells by type
    
    logger.info('Spell indexes created');
  }

  static async analyzeIndexes(): Promise<void> {
    try {
      const db = connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/codeclash');
      
      const collections = ['users', 'battles', 'puzzles', 'seasons', 'spells'];
      
      for (const collectionName of collections) {
        const stats = await db.collection(collectionName).aggregate([
          { $indexStats: {} }
        ]).toArray();
        
        logger.info(`Index stats for ${collectionName}:`, stats);
      }
    } catch (error) {
      logger.error('Failed to analyze indexes:', error);
    }
  }

  static async optimizeIndexes(): Promise<void> {
    try {
      const db = connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/codeclash');
      
      // Get slow queries (requires MongoDB profiler)
      const slowQueries = await db.collection('system.profile').find({
        millis: { $gt: 100 } // Queries taking more than 100ms
      }).sort({ ts: -1 }).limit(10).toArray();
      
      if (slowQueries.length > 0) {
        logger.warn('Slow queries detected:', slowQueries);
        
        // Suggest indexes based on slow queries
        for (const query of slowQueries) {
          if (query.command && query.command.filter) {
            const filter = query.command.filter;
            const suggestedIndex = Object.keys(filter).join(', ');
            logger.info(`Suggested index for ${query.ns}: { ${suggestedIndex} }`);
          }
        }
      }
      
      logger.info('Index optimization completed');
    } catch (error) {
      logger.error('Failed to optimize indexes:', error);
    }
  }

  static async dropUnusedIndexes(): Promise<void> {
    try {
      const db = connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/codeclash');
      
      const collections = await db.listCollections().toArray();
      
      for (const collection of collections) {
        const stats = await db.collection(collection.name).aggregate([
          { $indexStats: {} }
        ]).toArray();
        
        for (const stat of stats) {
          if (stat.name !== '_id_' && stat.accesses.ops === 0) {
            logger.warn(`Dropping unused index: ${collection.name}.${stat.name}`);
            await db.collection(collection.name).dropIndex(stat.name);
          }
        }
      }
      
      logger.info('Unused indexes dropped');
    } catch (error) {
      logger.error('Failed to drop unused indexes:', error);
    }
  }
}

// Export for use in migrations
export default DatabaseIndexManager;
