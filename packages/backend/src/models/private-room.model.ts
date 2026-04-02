import { Schema, model, Document } from 'mongoose';
import { PrivateRoom } from '@code-clash/shared-types';

// Private Room Document Interface
export interface IPrivateRoom extends Document {
  id: string;
  roomCode: string;
  creatorId: string;
  creatorUsername: string;
  guestId?: string;
  guestUsername?: string;
  isRanked: boolean;
  puzzleId?: string;
  state: 'waiting' | 'ready' | 'active' | 'ended';
  createdAt: Date;
  expiresAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  winnerId?: string;
  timeLimit?: number;
  creatorReady: boolean;
  guestReady: boolean;
  battleRoomId?: string; // Link to actual battle room when started
}

// Private Room Schema
const PrivateRoomSchema = new Schema<IPrivateRoom>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  roomCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^[A-Z0-9]{6}$/,
  },
  creatorId: {
    type: String,
    required: true,
    ref: 'User',
    index: true,
  },
  creatorUsername: {
    type: String,
    required: true,
  },
  guestId: {
    type: String,
    ref: 'User',
    index: true,
  },
  guestUsername: {
    type: String,
  },
  isRanked: {
    type: Boolean,
    default: false,
  },
  puzzleId: {
    type: String,
    ref: 'Puzzle',
  },
  state: {
    type: String,
    enum: ['waiting', 'ready', 'active', 'ended'],
    default: 'waiting',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  startedAt: {
    type: Date,
  },
  endedAt: {
    type: Date,
  },
  winnerId: {
    type: String,
    ref: 'User',
  },
  timeLimit: {
    type: Number,
    default: 600000, // 10 minutes default
  },
  creatorReady: {
    type: Boolean,
    default: false,
  },
  guestReady: {
    type: Boolean,
    default: false,
  },
  battleRoomId: {
    type: String,
    ref: 'BattleRoom',
  },
}, {
  timestamps: true,
  collection: 'private_rooms',
});

// Indexes for performance
PrivateRoomSchema.index({ roomCode: 1 });
PrivateRoomSchema.index({ creatorId: 1, state: 1 });
PrivateRoomSchema.index({ guestId: 1, state: 1 });
PrivateRoomSchema.index({ state: 1, createdAt: -1 });
PrivateRoomSchema.index({ expiresAt: 1 });

// Methods
PrivateRoomSchema.methods.addGuest = function(guestId: string, guestUsername: string) {
  this.guestId = guestId;
  this.guestUsername = guestUsername;
  this.state = 'ready';
  return this.save();
};

PrivateRoomSchema.methods.setCreatorReady = function(ready: boolean) {
  this.creatorReady = ready;
  this.checkBothReady();
  return this.save();
};

PrivateRoomSchema.methods.setGuestReady = function(ready: boolean) {
  this.guestReady = ready;
  this.checkBothReady();
  return this.save();
};

PrivateRoomSchema.methods.checkBothReady = function() {
  if (this.creatorReady && this.guestReady && this.state === 'ready') {
    this.state = 'active';
    this.startedAt = new Date();
  }
};

PrivateRoomSchema.methods.startBattle = function(battleRoomId: string) {
  this.battleRoomId = battleRoomId;
  this.state = 'active';
  this.startedAt = new Date();
  return this.save();
};

PrivateRoomSchema.methods.endBattle = function(winnerId: string) {
  this.state = 'ended';
  this.endedAt = new Date();
  this.winnerId = winnerId;
  return this.save();
};

PrivateRoomSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

PrivateRoomSchema.methods.extendExpiration = function(minutes: number) {
  this.expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  return this.save();
};

// Static methods
PrivateRoomSchema.statics.findByRoomCode = function(roomCode: string) {
  return this.findOne({ 
    roomCode: roomCode.toUpperCase(),
    state: { $in: ['waiting', 'ready'] },
    expiresAt: { $gt: new Date() }
  }).populate('creatorId guestId puzzleId');
};

PrivateRoomSchema.statics.findUserActiveRooms = function(userId: string) {
  return this.find({
    $or: [
      { creatorId: userId },
      { guestId: userId }
    ],
    state: { $in: ['waiting', 'ready', 'active'] },
    expiresAt: { $gt: new Date() }
  }).populate('creatorId guestId puzzleId');
};

PrivateRoomSchema.statics.findExpiredRooms = function() {
  return this.find({
    state: { $in: ['waiting', 'ready'] },
    expiresAt: { $lt: new Date() }
  });
};

PrivateRoomSchema.statics.generateRoomCode = function(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

PrivateRoomSchema.statics.createPrivateRoom = function(
  creatorId: string,
  creatorUsername: string,
  options: {
    isRanked?: boolean;
    puzzleId?: string;
    timeLimit?: number;
  } = {}
) {
  let roomCode: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    roomCode = this.generateRoomCode();
    attempts++;
  } while (attempts < maxAttempts && this.findOne({ roomCode }));

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique room code');
  }

  const room = new this({
    id: `private_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    roomCode,
    creatorId,
    creatorUsername,
    isRanked: options.isRanked || false,
    puzzleId: options.puzzleId,
    timeLimit: options.timeLimit || 600000,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  });

  return room.save();
};

// Pre-save middleware to validate room code uniqueness
PrivateRoomSchema.pre('save', async function(next) {
  if (!this.isModified('roomCode')) return next();

  const existingRoom = await this.constructor.findOne({ roomCode: this.roomCode });
  if (existingRoom && existingRoom.id !== this.id) {
    const error = new Error('Room code already exists');
    return next(error);
  }

  next();
});

// Export model
export const PrivateRoom = model<IPrivateRoom>('PrivateRoom', PrivateRoomSchema);
