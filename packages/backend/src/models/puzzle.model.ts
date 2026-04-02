import { Schema, model, Document } from 'mongoose';
import { Problem } from '@code-clash/shared-types';

// Puzzle Document Interface
export interface IPuzzle extends Document {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  testCases: Array<{
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
  }>;
  timeLimitMs: number;
  memoryLimitMb: number;
  tags: string[];
  starterCode: Record<string, string>; // language -> code
  constraints: string[];
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  timeBonusThreshold: number; // seconds for speed bonus
  efficiencyThreshold: number; // score threshold for efficiency bonus
  baseDamage: number;
  eloRange: {
    min: number;
    max: number;
  };
  submissionCount: number;
  successRate: number;
  averageTime: number; // average solve time in seconds
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Puzzle Schema
const PuzzleSchema = new Schema<IPuzzle>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true,
    index: true,
  },
  testCases: [{
    input: {
      type: String,
      required: true,
    },
    expectedOutput: {
      type: String,
      required: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
  }],
  timeLimitMs: {
    type: Number,
    required: true,
    default: 5000, // 5 seconds
  },
  memoryLimitMb: {
    type: Number,
    required: true,
    default: 128, // 128 MB
  },
  tags: [{
    type: String,
    trim: true,
    index: true,
  }],
  starterCode: {
    type: Map,
    of: String,
    default: {},
  },
  constraints: [{
    type: String,
  }],
  examples: [{
    input: {
      type: String,
      required: true,
    },
    output: {
      type: String,
      required: true,
    },
    explanation: {
      type: String,
    },
  }],
  timeBonusThreshold: {
    type: Number,
    required: true,
    default: 30, // 30 seconds
  },
  efficiencyThreshold: {
    type: Number,
    required: true,
    default: 0.8, // 80% efficiency score
  },
  baseDamage: {
    type: Number,
    required: true,
    default: 15,
  },
  eloRange: {
    min: {
      type: Number,
      required: true,
      default: 0,
    },
    max: {
      type: Number,
      required: true,
      default: 3000,
    },
  },
  submissionCount: {
    type: Number,
    default: 0,
  },
  successRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  averageTime: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: String,
    required: true,
    ref: 'User',
  },
}, {
  timestamps: true,
  collection: 'puzzles',
});

// Indexes for performance
PuzzleSchema.index({ difficulty: 1, isActive: 1 });
PuzzleSchema.index({ tags: 1 });
PuzzleSchema.index({ 'eloRange.min': 1, 'eloRange.max': 1 });
PuzzleSchema.index({ submissionCount: -1 });
PuzzleSchema.index({ successRate: -1 });

// Puzzle Submission Document Interface
export interface IPuzzleSubmission extends Document {
  puzzleId: string;
  userId: string;
  battleId?: string;
  code: string;
  language: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'timeout';
  passedTests: number;
  totalTests: number;
  executionTimeMs: number;
  memoryUsageMb: number;
  output?: string;
  error?: string;
  compileError?: string;
  isCorrect: boolean;
  efficiencyScore: number;
  speedBonus: number;
  damageDealt: number;
  submittedAt: Date;
  judgedAt?: Date;
}

// Puzzle Submission Schema
const PuzzleSubmissionSchema = new Schema<IPuzzleSubmission>({
  puzzleId: {
    type: String,
    required: true,
    ref: 'Puzzle',
    index: true,
  },
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  battleId: {
    type: String,
    ref: 'BattleRoom',
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
    enum: ['javascript', 'python', 'java', 'cpp'],
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'error', 'timeout'],
    default: 'pending',
  },
  passedTests: {
    type: Number,
    default: 0,
  },
  totalTests: {
    type: Number,
    required: true,
  },
  executionTimeMs: {
    type: Number,
    default: 0,
  },
  memoryUsageMb: {
    type: Number,
    default: 0,
  },
  output: {
    type: String,
  },
  error: {
    type: String,
  },
  compileError: {
    type: String,
  },
  isCorrect: {
    type: Boolean,
    default: false,
  },
  efficiencyScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  speedBonus: {
    type: Number,
    default: 0,
  },
  damageDealt: {
    type: Number,
    default: 0,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  judgedAt: {
    type: Date,
  },
}, {
  timestamps: true,
  collection: 'puzzle_submissions',
});

// Indexes
PuzzleSubmissionSchema.index({ puzzleId: 1, userId: 1 });
PuzzleSubmissionSchema.index({ userId: 1, submittedAt: -1 });
PuzzleSubmissionSchema.index({ battleId: 1 });
PuzzleSubmissionSchema.index({ status: 1, submittedAt: -1 });
PuzzleSubmissionSchema.index({ isCorrect: 1 });

// Puzzle Stats Document Interface (for analytics)
export interface IPuzzleStats extends Document {
  puzzleId: string;
  totalSubmissions: number;
  correctSubmissions: number;
  averageTime: number;
  averageAttempts: number;
  successRate: number;
  languageStats: Record<string, {
    submissions: number;
    successRate: number;
    averageTime: number;
  }>;
  difficultyStats: {
    easy: { submissions: number; successRate: number };
    medium: { submissions: number; successRate: number };
    hard: { submissions: number; successRate: number };
  };
  lastUpdated: Date;
}

// Puzzle Stats Schema
const PuzzleStatsSchema = new Schema<IPuzzleStats>({
  puzzleId: {
    type: String,
    required: true,
    unique: true,
    ref: 'Puzzle',
    index: true,
  },
  totalSubmissions: {
    type: Number,
    default: 0,
  },
  correctSubmissions: {
    type: Number,
    default: 0,
  },
  averageTime: {
    type: Number,
    default: 0,
  },
  averageAttempts: {
    type: Number,
    default: 0,
  },
  successRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  languageStats: {
    type: Map,
    of: new Schema({
      submissions: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
      averageTime: { type: Number, default: 0 },
    }, { _id: false }),
    default: {},
  },
  difficultyStats: {
    easy: {
      submissions: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
    },
    medium: {
      submissions: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
    },
    hard: {
      submissions: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
    },
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  collection: 'puzzle_stats',
});

// Methods for Puzzle
PuzzleSchema.methods.updateStats = async function(submission: IPuzzleSubmission) {
  this.submissionCount += 1;
  
  if (submission.isCorrect) {
    const newSuccessCount = this.successRate * (this.submissionCount - 1) + 1;
    this.successRate = newSuccessCount / this.submissionCount;
    
    // Update average time
    const newTotalTime = this.averageTime * (this.submissionCount - 1) + (submission.executionTimeMs / 1000);
    this.averageTime = newTotalTime / this.submissionCount;
  }
  
  return this.save();
};

PuzzleSchema.methods.isInEloRange = function(elo: number) {
  return elo >= this.eloRange.min && elo <= this.eloRange.max;
};

// Static methods for Puzzle
PuzzleSchema.statics.findByDifficulty = function(difficulty: string, limit = 20) {
  return this.find({ difficulty, isActive: true })
    .sort({ submissionCount: -1 })
    .limit(limit);
};

PuzzleSchema.statics.findByEloRange = function(elo: number, limit = 10) {
  return this.find({
    isActive: true,
    'eloRange.min': { $lte: elo },
    'eloRange.max': { $gte: elo }
  })
  .sort({ successRate: 1 }) // Easier puzzles first
  .limit(limit);
};

PuzzleSchema.statics.findByTags = function(tags: string[], limit = 20) {
  return this.find({ 
    tags: { $in: tags }, 
    isActive: true 
  })
  .sort({ submissionCount: -1 })
  .limit(limit);
};

PuzzleSchema.statics.getRandomPuzzle = function(difficulty?: string, elo?: number) {
  const query: any = { isActive: true };
  
  if (difficulty) {
    query.difficulty = difficulty;
  }
  
  if (elo) {
    query['eloRange.min'] = { $lte: elo };
    query['eloRange.max'] = { $gte: elo };
  }
  
  return this.aggregate([
    { $match: query },
    { $sample: { size: 1 } }
  ]);
};

PuzzleSchema.statics.getPopularPuzzles = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ submissionCount: -1, successRate: 1 })
    .limit(limit)
    .populate('createdBy', 'username');
};

// Methods for PuzzleSubmission
PuzzleSubmissionSchema.methods.calculateEfficiency = function() {
  // Simple efficiency calculation based on time and memory
  const timeEfficiency = Math.min(1, 1000 / Math.max(1, this.executionTimeMs));
  const memoryEfficiency = Math.min(1, 64 / Math.max(1, this.memoryUsageMb));
  const correctnessEfficiency = this.passedTests / this.totalTests;
  
  this.efficiencyScore = (timeEfficiency * 0.4 + memoryEfficiency * 0.3 + correctnessEfficiency * 0.3);
  return this.efficiencyScore;
};

PuzzleSubmissionSchema.methods.calculateDamage = function(puzzle: IPuzzle) {
  const baseDamage = puzzle.baseDamage;
  const efficiencyMultiplier = this.calculateEfficiency();
  const speedMultiplier = this.executionTimeMs < puzzle.timeBonusThreshold * 1000 ? 1.5 : 1;
  
  this.damageDealt = Math.round(baseDamage * efficiencyMultiplier * speedMultiplier);
  return this.damageDealt;
};

// Static methods for PuzzleSubmission
PuzzleSubmissionSchema.statics.getUserStats = function(userId: string) {
  return this.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: '$userId',
        totalSubmissions: { $sum: 1 },
        correctSubmissions: { 
          $sum: { $cond: ['$isCorrect', 1, 0] }
        },
        averageTime: { $avg: '$executionTimeMs' },
        averageDamage: { $avg: '$damageDealt' },
        successRate: {
          $avg: { $cond: ['$isCorrect', 1, 0] }
        },
        languageBreakdown: {
          $push: {
            language: '$language',
            isCorrect: '$isCorrect',
            damage: '$damageDealt'
          }
        }
      }
    }
  ]);
};

PuzzleSubmissionSchema.statics.getPuzzleStats = function(puzzleId: string) {
  return this.aggregate([
    { $match: { puzzleId: puzzleId } },
    {
      $group: {
        _id: '$puzzleId',
        totalSubmissions: { $sum: 1 },
        correctSubmissions: { 
          $sum: { $cond: ['$isCorrect', 1, 0] }
        },
        averageTime: { $avg: '$executionTimeMs' },
        averageDamage: { $avg: '$damageDealt' },
        successRate: {
          $avg: { $cond: ['$isCorrect', 1, 0] }
        },
        languageStats: {
          $push: {
            language: '$language',
            isCorrect: '$isCorrect',
            executionTime: '$executionTimeMs'
          }
        }
      }
    }
  ]);
};

// Export models
export const Puzzle = model<IPuzzle>('Puzzle', PuzzleSchema);
export const PuzzleSubmission = model<IPuzzleSubmission>('PuzzleSubmission', PuzzleSubmissionSchema);
export const PuzzleStats = model<IPuzzleStats>('PuzzleStats', PuzzleStatsSchema);
