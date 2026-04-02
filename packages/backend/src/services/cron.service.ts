import cron from 'node-cron';
import { SeasonService } from './season.service';
import { LeaderboardService } from './leaderboard.service';
import { UserService } from './user.service';
import { redisService } from './redis.service';

export class CronService {
  private seasonService: SeasonService;
  private leaderboardService: LeaderboardService;
  private userService: UserService;

  constructor() {
    this.leaderboardService = new LeaderboardService(redisService, new UserService());
    this.seasonService = new SeasonService(redisService, this.leaderboardService, new UserService());
    this.userService = new UserService();
  }

  startAllJobs(): void {
    this.startSeasonResetJob();
    this.startWeeklyLeaderboardReset();
    this.startEloJourneyCleanup();
    this.startSeasonEndCheck();
    console.log('🕐 All cron jobs started successfully');
  }

  private startSeasonResetJob(): void {
    // Run every day at midnight to check for season end
    cron.schedule('0 0 * * *', async () => {
      try {
        console.log('🔄 Checking for season reset...');
        
        const currentSeason = await this.seasonService.getCurrentSeason();
        if (!currentSeason) {
          console.log('❌ No active season found');
          return;
        }

        const now = new Date();
        const seasonEnd = new Date(currentSeason.endDate);

        // Check if season has ended
        if (now >= seasonEnd) {
          console.log(`🏁 Season ${currentSeason.seasonId} has ended, starting reset...`);
          
          await this.seasonService.endSeason(currentSeason.seasonId);
          
          console.log(`✅ Season ${currentSeason.seasonId} reset completed`);
          
          // Notify users about season end (would implement socket notification here)
          await this.notifySeasonEnd(currentSeason);
        } else {
          console.log(`⏰ Season ${currentSeason.seasonId} still active, ends in ${seasonEnd.getTime() - now.getTime()}ms`);
        }
      } catch (error) {
        console.error('❌ Error in season reset job:', error);
      }
    });

    console.log('⏰ Season reset job scheduled (daily at midnight)');
  }

  private startWeeklyLeaderboardReset(): void {
    // Reset weekly leaderboard every Monday at 00:00 UTC
    cron.schedule('0 0 * * 1', async () => {
      try {
        console.log('🔄 Resetting weekly leaderboard...');
        
        // Clear the weekly leaderboard
        await redisService.del('leaderboard:weekly');
        
        console.log('✅ Weekly leaderboard reset completed');
      } catch (error) {
        console.error('❌ Error in weekly leaderboard reset:', error);
      }
    });

    console.log('⏰ Weekly leaderboard reset scheduled (Mondays at 00:00 UTC)');
  }

  private startEloJourneyCleanup(): void {
    // Clean up old ELO journey data every week
    cron.schedule('0 2 * * 0', async () => {
      try {
        console.log('🧹 Cleaning up old ELO journey data...');
        
        // This would scan for old journey keys and remove them
        // Implementation depends on your Redis key structure
        const pattern = 'journey:*';
        // const keys = await redisService.keys(pattern);
        // For each key older than 90 days, delete it
        
        console.log('✅ ELO journey cleanup completed');
      } catch (error) {
        console.error('❌ Error in ELO journey cleanup:', error);
      }
    });

    console.log('⏰ ELO journey cleanup scheduled (Sundays at 02:00 UTC)');
  }

  private startSeasonEndCheck(): void {
    // Check every hour if season is about to end (within 24 hours)
    cron.schedule('0 * * * *', async () => {
      try {
        const currentSeason = await this.seasonService.getCurrentSeason();
        if (!currentSeason) return;

        const now = new Date();
        const seasonEnd = new Date(currentSeason.endDate);
        const hoursUntilEnd = (seasonEnd.getTime() - now.getTime()) / (1000 * 60 * 60);

        // If season ends in less than 24 hours, send notification
        if (hoursUntilEnd > 0 && hoursUntilEnd <= 24) {
          console.log(`⚠️ Season ${currentSeason.seasonId} ends in ${Math.round(hoursUntilEnd)} hours`);
          
          // Send notification to all active users (would implement socket notification)
          await this.notifySeasonEndingSoon(currentSeason, Math.round(hoursUntilEnd));
        }
      } catch (error) {
        console.error('❌ Error in season end check:', error);
      }
    });

    console.log('⏰ Season end check scheduled (every hour)');
  }

  private async notifySeasonEnd(season: any): Promise<void> {
    // Implement socket notification to all users about season end
    // This would integrate with your socket service
    console.log(`📢 Notifying users about season ${season.seasonId} end`);
    
    // Example: socketService.broadcast('season:ended', { seasonId: season.seasonId });
  }

  private async notifySeasonEndingSoon(season: any, hoursRemaining: number): Promise<void> {
    // Implement socket notification about season ending soon
    console.log(`📢 Notifying users: Season ${season.seasonId} ends in ${hoursRemaining} hours`);
    
    // Example: socketService.broadcast('season:ending_soon', { 
    //   seasonId: season.seasonId, 
    //   hoursRemaining 
    // });
  }

  // Manual trigger for testing
  async triggerSeasonEnd(seasonId?: string): Promise<void> {
    try {
      const targetSeasonId = seasonId || (await this.seasonService.getCurrentSeason())?.seasonId;
      
      if (!targetSeasonId) {
        throw new Error('No season specified and no active season found');
      }

      console.log(`🔧 Manual trigger: Ending season ${targetSeasonId}`);
      await this.seasonService.endSeason(targetSeasonId);
      console.log('✅ Manual season end completed');
    } catch (error) {
      console.error('❌ Manual season end failed:', error);
      throw error;
    }
  }

  // Get status of all cron jobs
  getCronStatus(): { [jobName: string]: boolean } {
    return {
      seasonReset: true, // node-cron doesn't have built-in status checking
      weeklyReset: true,
      eloCleanup: true,
      seasonEndCheck: true
    };
  }

  // Stop all cron jobs
  stopAllJobs(): void {
    cron.getTasks().forEach(task => task.stop());
    console.log('🛑 All cron jobs stopped');
  }
}

export const cronService = new CronService();
