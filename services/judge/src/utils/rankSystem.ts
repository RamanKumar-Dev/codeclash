export enum RankTier {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum',
  DIAMOND = 'Diamond',
  MASTER = 'Master'
}

export interface RankInfo {
  tier: RankTier;
  minElo: number;
  maxElo: number;
  title: string;
  color: string;
  icon: string;
}

export const RANK_THRESHOLDS: Record<RankTier, RankInfo> = {
  [RankTier.BRONZE]: {
    tier: RankTier.BRONZE,
    minElo: 0,
    maxElo: 1199,
    title: 'Bronze Coder',
    color: '#CD7F32',
    icon: '🥉'
  },
  [RankTier.SILVER]: {
    tier: RankTier.SILVER,
    minElo: 1200,
    maxElo: 1399,
    title: 'Silver Coder',
    color: '#C0C0C0',
    icon: '🥈'
  },
  [RankTier.GOLD]: {
    tier: RankTier.GOLD,
    minElo: 1400,
    maxElo: 1599,
    title: 'Gold Coder',
    color: '#FFD700',
    icon: '🥇'
  },
  [RankTier.PLATINUM]: {
    tier: RankTier.PLATINUM,
    minElo: 1600,
    maxElo: 1799,
    title: 'Platinum Coder',
    color: '#E5E4E2',
    icon: '💎'
  },
  [RankTier.DIAMOND]: {
    tier: RankTier.DIAMOND,
    minElo: 1800,
    maxElo: 1999,
    title: 'Diamond Coder',
    color: '#B9F2FF',
    icon: '💠'
  },
  [RankTier.MASTER]: {
    tier: RankTier.MASTER,
    minElo: 2000,
    maxElo: Infinity,
    title: 'Master Coder',
    color: '#FF6B35',
    icon: '👑'
  }
};

export class RankSystem {
  /**
   * Get rank tier based on ELO rating
   */
  static getRankByElo(elo: number): RankInfo {
    for (const [tier, info] of Object.entries(RANK_THRESHOLDS)) {
      if (elo >= info.minElo && elo <= info.maxElo) {
        return info;
      }
    }
    return RANK_THRESHOLDS[RankTier.BRONZE];
  }

  /**
   * Get rank tier by enum name
   */
  static getRankByName(tierName: string): RankInfo {
    const tier = tierName as RankTier;
    return RANK_THRESHOLDS[tier] || RANK_THRESHOLDS[RankTier.BRONZE];
  }

  /**
   * Check if player can battle another player based on rank restrictions
   * Players can only battle within 2 tiers of their own tier
   */
  static canBattle(playerElo: number, opponentElo: number): boolean {
    const playerRank = this.getRankByElo(playerElo);
    const opponentRank = this.getRankByElo(opponentElo);
    
    const tiers = Object.values(RankTier);
    const playerTierIndex = tiers.indexOf(playerRank.tier);
    const opponentTierIndex = tiers.indexOf(opponentRank.tier);
    
    return Math.abs(playerTierIndex - opponentTierIndex) <= 2;
  }

  /**
   * Get maximum ELO difference allowed for matchmaking (400)
   */
  static getMaxEloDifference(): number {
    return 400;
  }

  /**
   * Check if ELO difference is within allowed range
   */
  static isEloDifferenceAllowed(playerElo: number, opponentElo: number): boolean {
    return Math.abs(playerElo - opponentElo) <= this.getMaxEloDifference();
  }

  /**
   * Check if two players can be matched based on all restrictions
   */
  static canMatch(playerElo: number, opponentElo: number): boolean {
    return this.canBattle(playerElo, opponentElo) && 
           this.isEloDifferenceAllowed(playerElo, opponentElo);
  }

  /**
   * Get rank progress percentage within current tier
   */
  static getRankProgress(elo: number): number {
    const rank = this.getRankByElo(elo);
    
    if (rank.tier === RankTier.MASTER) {
      return 100; // Master is the highest tier
    }
    
    const tierRange = rank.maxElo - rank.minElo;
    const progress = elo - rank.minElo;
    
    return Math.round((progress / tierRange) * 100);
  }

  /**
   * Get ELO required to reach next tier
   */
  static getEloForNextTier(elo: number): number | null {
    const currentRank = this.getRankByElo(elo);
    
    if (currentRank.tier === RankTier.MASTER) {
      return null; // Already at highest tier
    }
    
    const tiers = Object.values(RankTier);
    const currentIndex = tiers.indexOf(currentRank.tier);
    const nextTier = tiers[currentIndex + 1];
    
    return RANK_THRESHOLDS[nextTier].minElo;
  }

  /**
   * Get ELO required to maintain current tier (avoid demotion)
   */
  static getEloToMaintainTier(elo: number): number {
    const rank = this.getRankByElo(elo);
    return rank.minElo;
  }

  /**
   * Get all rank tiers for display
   */
  static getAllRanks(): RankInfo[] {
    return Object.values(RANK_THRESHOLDS);
  }

  /**
   * Get rank distribution statistics
   */
  static getRankDistribution(playerElos: number[]): Record<RankTier, number> {
    const distribution: Record<RankTier, number> = {
      [RankTier.BRONZE]: 0,
      [RankTier.SILVER]: 0,
      [RankTier.GOLD]: 0,
      [RankTier.PLATINUM]: 0,
      [RankTier.DIAMOND]: 0,
      [RankTier.MASTER]: 0
    };

    playerElos.forEach(elo => {
      const rank = this.getRankByElo(elo);
      distribution[rank.tier]++;
    });

    return distribution;
  }

  /**
   * Validate if ELO is within acceptable bounds
   */
  static isValidElo(elo: number): boolean {
    return elo >= 0 && elo <= 5000;
  }

  /**
   * Get minimum ELO allowed (800 - floor for decay)
   */
  static getMinimumElo(): number {
    return 800;
  }

  /**
   * Apply minimum ELO constraint
   */
  static applyMinimumElo(elo: number): number {
    return Math.max(elo, this.getMinimumElo());
  }
}
