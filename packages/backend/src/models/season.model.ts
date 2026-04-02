import { Schema, model, Document } from 'mongoose';
import { Season, SeasonReward, SeasonTopPlayer } from '@code-clash/shared-types';

export interface ISeason extends Document, Omit<Season, 'id'> {
  seasonId: string;
  createdAt: Date;
  updatedAt: Date;
}

const SeasonRewardSchema = new Schema<SeasonReward>({
  rank: { type: Number, required: true },
  rewardType: {
    type: String,
    required: true,
    enum: ['badge', 'tokens', 'xp', 'title']
  },
  value: { type: Schema.Types.Mixed, required: true },
  description: { type: String, required: true, maxlength: 200 }
}, { _id: false });

const SeasonTopPlayerSchema = new Schema<SeasonTopPlayer>({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  rank: { type: Number, required: true },
  elo: { type: Number, required: true },
  battlesWon: { type: Number, required: true },
  rewards: [SeasonRewardSchema]
}, { _id: false });

const SeasonSchema = new Schema<ISeason>({
  seasonId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  rewards: [SeasonRewardSchema],
  topPlayers: [SeasonTopPlayerSchema]
}, {
  timestamps: true,
  collection: 'seasons'
});

// Indexes for efficient queries
SeasonSchema.index({ startDate: -1, endDate: -1 });
SeasonSchema.index({ isActive: 1, endDate: -1 });
SeasonSchema.index({ 'topPlayers.userId': 1 });

export const SeasonModel = model<ISeason>('Season', SeasonSchema);
