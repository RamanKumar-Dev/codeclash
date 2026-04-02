import { Schema, model, Document } from 'mongoose';
import { BattleRoom, BattleState, DamageLog, BattleStats } from '@code-clash/shared-types';

// Battle Room Document Interface
export interface IBattleRoom extends Document {
  id: string;
  player1Id: string;
  player2Id: string;
  puzzleId: string;
  state: BattleState;
  startedAt?: Date;
  endedAt?: Date;
  timeLimit: number;
  currentRound: number;
  winnerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Battle Room Schema
const BattleRoomSchema = new Schema<IBattleRoom>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  player1Id: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  player2Id: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  puzzleId: {
    type: String,
    required: true,
    ref: 'Puzzle',
    index: true,
  },
  state: {
    type: String,
    enum: ['WAITING', 'COUNTDOWN', 'ACTIVE', 'JUDGING', 'ENDED'],
    default: 'WAITING',
    index: true,
  },
  startedAt: {
    type: Date,
  },
  endedAt: {
    type: Date,
  },
  timeLimit: {
    type: Number,
    required: true,
  },
  currentRound: {
    type: Number,
    default: 1,
  },
  winnerId: {
    type: String,
    ref: 'User',
  },
}, {
  timestamps: true,
  collection: 'battle_rooms',
});

// Indexes for performance
BattleRoomSchema.index({ player1Id: 1, state: 1 });
BattleRoomSchema.index({ player2Id: 1, state: 1 });
BattleRoomSchema.index({ state: 1, createdAt: -1 });
BattleRoomSchema.index({ puzzleId: 1 });

// Battle Participant Document Interface
export interface IBattleParticipant extends Document {
  battleId: string;
  userId: string;
  username: string;
  elo: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  submissions: number;
  lastActivity: Date;
  isDisconnected: boolean;
  finalHp: number;
  totalDamageDealt: number;
  puzzlesSolved: number;
  createdAt: Date;
  updatedAt: Date;
}

// Battle Participant Schema
const BattleParticipantSchema = new Schema<IBattleParticipant>({
  battleId: {
    type: String,
    required: true,
    ref: 'BattleRoom',
    index: true,
  },
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  username: {
    type: String,
    required: true,
  },
  elo: {
    type: Number,
    required: true,
  },
  hp: {
    type: Number,
    required: true,
    default: 100,
  },
  maxHp: {
    type: Number,
    required: true,
    default: 100,
  },
  mana: {
    type: Number,
    required: true,
    default: 50,
  },
  maxMana: {
    type: Number,
    required: true,
    default: 100,
  },
  submissions: {
    type: Number,
    default: 0,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  isDisconnected: {
    type: Boolean,
    default: false,
  },
  finalHp: {
    type: Number,
  },
  totalDamageDealt: {
    type: Number,
    default: 0,
  },
  puzzlesSolved: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  collection: 'battle_participants',
});

// Indexes
BattleParticipantSchema.index({ battleId: 1, userId: 1 }, { unique: true });
BattleParticipantSchema.index({ userId: 1, lastActivity: -1 });
BattleParticipantSchema.index({ battleId: 1, isDisconnected: 1 });

// Damage Log Document Interface
export interface IDamageLog extends Document {
  battleId: string;
  sourcePlayer: string;
  targetPlayer: string;
  damage: number;
  type: 'puzzle' | 'spell';
  timestamp: Date;
  details: any; // Judge result or spell effect details
  round: number;
}

// Damage Log Schema
const DamageLogSchema = new Schema<IDamageLog>({
  battleId: {
    type: String,
    required: true,
    ref: 'BattleRoom',
    index: true,
  },
  sourcePlayer: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  targetPlayer: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  damage: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['puzzle', 'spell'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  details: {
    type: Schema.Types.Mixed,
  },
  round: {
    type: Number,
    required: true,
  },
}, {
  collection: 'damage_logs',
});

// Indexes
DamageLogSchema.index({ battleId: 1, timestamp: 1 });
DamageLogSchema.index({ sourcePlayer: 1, timestamp: -1 });
DamageLogSchema.index({ targetPlayer: 1, timestamp: -1 });

// Battle Stats Document Interface (for completed battles)
export interface IBattleStats extends Document {
  battleId: string;
  winner: string;
  loser: string;
  duration: number; // in milliseconds
  totalSubmissions: number;
  damageLog: DamageLog[];
  eloChange: {
    winner: number;
    loser: number;
  };
  rewards: {
    winner: { xp: number; tokens: number };
    loser: { xp: number; tokens: number };
  };
  puzzleId: string;
  seasonId?: string;
  createdAt: Date;
}

// Battle Stats Schema
const BattleStatsSchema = new Schema<IBattleStats>({
  battleId: {
    type: String,
    required: true,
    unique: true,
    ref: 'BattleRoom',
    index: true,
  },
  winner: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  loser: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  totalSubmissions: {
    type: Number,
    required: true,
  },
  damageLog: [{
    type: Schema.Types.Mixed,
  }],
  eloChange: {
    winner: { type: Number, required: true },
    loser: { type: Number, required: true },
  },
  rewards: {
    winner: { 
      xp: { type: Number, required: true },
      tokens: { type: Number, required: true }
    },
    loser: { 
      xp: { type: Number, required: true },
      tokens: { type: Number, required: true }
    },
  },
  puzzleId: {
    type: String,
    required: true,
    ref: 'Puzzle',
  },
  seasonId: {
    type: String,
    ref: 'Season',
    index: true,
  },
}, {
  timestamps: true,
  collection: 'battle_stats',
});

// Indexes
BattleStatsSchema.index({ winner: 1, createdAt: -1 });
BattleStatsSchema.index({ loser: 1, createdAt: -1 });
BattleStatsSchema.index({ seasonId: 1, createdAt: -1 });
BattleStatsSchema.index({ puzzleId: 1, createdAt: -1 });

// Virtual for win rate
BattleStatsSchema.virtual('winRate').get(function() {
  return this.totalSubmissions > 0 ? this.damageLog.filter((log: any) => log.type === 'puzzle' && log.sourcePlayer === this.winner).length / this.totalSubmissions : 0;
});

// Methods for BattleRoom
BattleRoomSchema.methods.markAsEnded = function(winnerId: string) {
  this.state = 'ENDED';
  this.endedAt = new Date();
  this.winnerId = winnerId;
  return this.save();
};

BattleRoomSchema.methods.startBattle = function() {
  this.state = 'ACTIVE';
  this.startedAt = new Date();
  return this.save();
};

// Static methods
BattleRoomSchema.statics.findActiveBattles = function(userId: string) {
  return this.find({
    $or: [{ player1Id: userId }, { player2Id: userId }],
    state: { $in: ['WAITING', 'COUNTDOWN', 'ACTIVE', 'JUDGING'] }
  }).populate('player1Id player2Id puzzleId');
};

BattleRoomSchema.statics.findBattleHistory = function(userId: string, limit = 10) {
  return this.find({
    $or: [{ player1Id: userId }, { player2Id: userId }],
    state: 'ENDED'
  })
  .sort({ endedAt: -1 })
  .limit(limit)
  .populate('player1Id player2Id puzzleId winnerId');
};

BattleRoomSchema.statics.getBattlesByPuzzle = function(puzzleId: string, limit = 50) {
  return this.find({ puzzleId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('player1Id player2Id winnerId');
};

// Methods for BattleParticipant
BattleParticipantSchema.methods.updateHp = function(newHp: number) {
  this.hp = Math.max(0, Math.min(this.maxHp, newHp));
  this.lastActivity = new Date();
  return this.save();
};

BattleParticipantSchema.methods.addSubmission = function() {
  this.submissions += 1;
  this.lastActivity = new Date();
  return this.save();
};

BattleParticipantSchema.methods.dealDamage = function(damage: number) {
  this.totalDamageDealt += damage;
  return this.save();
};

// Static methods for BattleParticipant
BattleParticipantSchema.statics.findParticipantStats = function(userId: string) {
  return this.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: '$userId',
        totalBattles: { $sum: 1 },
        totalWins: { 
          $sum: {
            $cond: [{ $gt: ['$finalHp', 0] }, 1, 0]
          }
        },
        totalDamageDealt: { $sum: '$totalDamageDealt' },
        totalSubmissions: { $sum: '$submissions' },
        averageElo: { $avg: '$elo' },
        winRate: {
          $avg: {
            $cond: [{ $gt: ['$finalHp', 0] }, 1, 0]
          }
        }
      }
    }
  ]);
};

// Export models
export const BattleRoom = model<IBattleRoom>('BattleRoom', BattleRoomSchema);
export const BattleParticipant = model<IBattleParticipant>('BattleParticipant', BattleParticipantSchema);
export const DamageLog = model<IDamageLog>('DamageLog', DamageLogSchema);
export const BattleStats = model<IBattleStats>('BattleStats', BattleStatsSchema);
