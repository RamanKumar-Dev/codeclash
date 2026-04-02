import { Schema, model, Document } from 'mongoose';
import { Friend, FriendRequest, OnlineStatus } from '@code-clash/shared-types';

// User Document Interface with Social Features
export interface IUser extends Document {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  elo: number;
  totalWins: number;
  totalLosses: number;
  totalDamageDealt: number;
  puzzlesSolved: number;
  createdAt: Date;
  lastActive: Date;
  isOnline: boolean;
  githubId?: string;
  avatarUrl?: string;
  
  // Social features
  friends: Array<{
    userId: string;
    username: string;
    friendshipStarted: Date;
    gamesPlayedTogether: number;
  }>;
  pendingRequests: Array<{
    fromUserId: string;
    fromUsername: string;
    createdAt: Date;
  }>;
  blockedUsers: string[];
  
  // Preferences
  preferences: {
    allowFriendRequests: boolean;
    showOnlineStatus: boolean;
    allowSpectators: boolean;
    preferredLanguage: string;
    notifications: {
      friendRequests: boolean;
      battleInvites: boolean;
      newsUpdates: boolean;
    };
  };
  
  // Stats
  stats: {
    currentWinStreak: number;
    longestWinStreak: number;
    totalBattles: number;
    averageDamagePerBattle: number;
    favoriteLanguage: string;
    battlesByDifficulty: {
      easy: number;
      medium: number;
      hard: number;
    };
  };
}

// User Schema
const UserSchema = new Schema<IUser>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  elo: {
    type: Number,
    default: 1200,
    min: 0,
    index: true,
  },
  totalWins: {
    type: Number,
    default: 0,
  },
  totalLosses: {
    type: Number,
    default: 0,
  },
  totalDamageDealt: {
    type: Number,
    default: 0,
  },
  puzzlesSolved: {
    type: Number,
    default: 0,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  isOnline: {
    type: Boolean,
    default: false,
    index: true,
  },
  githubId: {
    type: String,
    sparse: true,
  },
  avatarUrl: {
    type: String,
  },
  
  // Social features
  friends: [{
    userId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    friendshipStarted: {
      type: Date,
      default: Date.now,
    },
    gamesPlayedTogether: {
      type: Number,
      default: 0,
    },
  }],
  pendingRequests: [{
    fromUserId: {
      type: String,
      required: true,
      index: true,
    },
    fromUsername: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  blockedUsers: [{
    type: String,
  }],
  
  // Preferences
  preferences: {
    allowFriendRequests: {
      type: Boolean,
      default: true,
    },
    showOnlineStatus: {
      type: Boolean,
      default: true,
    },
    allowSpectators: {
      type: Boolean,
      default: true,
    },
    preferredLanguage: {
      type: String,
      default: 'javascript',
      enum: ['javascript', 'python', 'java', 'cpp'],
    },
    notifications: {
      friendRequests: {
        type: Boolean,
        default: true,
      },
      battleInvites: {
        type: Boolean,
        default: true,
      },
      newsUpdates: {
        type: Boolean,
        default: true,
      },
    },
  },
  
  // Stats
  stats: {
    currentWinStreak: {
      type: Number,
      default: 0,
    },
    longestWinStreak: {
      type: Number,
      default: 0,
    },
    totalBattles: {
      type: Number,
      default: 0,
    },
    averageDamagePerBattle: {
      type: Number,
      default: 0,
    },
    favoriteLanguage: {
      type: String,
      default: 'javascript',
    },
    battlesByDifficulty: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
  },
}, {
  timestamps: true,
  collection: 'users',
});

// Indexes for performance
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ elo: -1 });
UserSchema.index({ 'friends.userId': 1 });
UserSchema.index({ 'pendingRequests.fromUserId': 1 });
UserSchema.index({ isOnline: 1, lastActive: -1 });
UserSchema.index({ totalWins: -1 });

// Virtual for win rate
UserSchema.virtual('winRate').get(function() {
  const total = this.totalWins + this.totalLosses;
  return total > 0 ? this.totalWins / total : 0;
});

// Virtual for rank (based on ELO)
UserSchema.virtual('rank').get(function() {
  if (this.elo >= 2000) return 'Grandmaster';
  if (this.elo >= 1800) return 'Master';
  if (this.elo >= 1600) return 'Diamond';
  if (this.elo >= 1400) return 'Platinum';
  if (this.elo >= 1200) return 'Gold';
  if (this.elo >= 1000) return 'Silver';
  return 'Bronze';
});

// Methods for friend management
UserSchema.methods.sendFriendRequest = function(targetUserId: string, targetUsername: string) {
  // Check if already friends or request exists
  const isAlreadyFriend = this.friends.some(f => f.userId === targetUserId);
  const hasPendingRequest = this.pendingRequests.some(r => r.fromUserId === targetUserId);
  
  if (isAlreadyFriend || hasPendingRequest) {
    throw new Error('Already friends or request pending');
  }
  
  this.pendingRequests.push({
    fromUserId: targetUserId,
    fromUsername: targetUsername,
    createdAt: new Date(),
  });
  
  return this.save();
};

UserSchema.methods.acceptFriendRequest = function(fromUserId: string) {
  const requestIndex = this.pendingRequests.findIndex(r => r.fromUserId === fromUserId);
  if (requestIndex === -1) {
    throw new Error('Friend request not found');
  }
  
  const request = this.pendingRequests[requestIndex];
  this.pendingRequests.splice(requestIndex, 1);
  
  this.friends.push({
    userId: fromUserId,
    username: request.fromUsername,
    friendshipStarted: new Date(),
    gamesPlayedTogether: 0,
  });
  
  return this.save();
};

UserSchema.methods.declineFriendRequest = function(fromUserId: string) {
  const requestIndex = this.pendingRequests.findIndex(r => r.fromUserId === fromUserId);
  if (requestIndex === -1) {
    throw new Error('Friend request not found');
  }
  
  this.pendingRequests.splice(requestIndex, 1);
  return this.save();
};

UserSchema.methods.removeFriend = function(friendUserId: string) {
  const friendIndex = this.friends.findIndex(f => f.userId === friendUserId);
  if (friendIndex === -1) {
    throw new Error('Friend not found');
  }
  
  this.friends.splice(friendIndex, 1);
  return this.save();
};

UserSchema.methods.blockUser = function(userId: string) {
  if (!this.blockedUsers.includes(userId)) {
    this.blockedUsers.push(userId);
    
    // Remove from friends if exists
    this.friends = this.friends.filter(f => f.userId !== userId);
    
    // Remove pending requests
    this.pendingRequests = this.pendingRequests.filter(r => r.fromUserId !== userId);
  }
  
  return this.save();
};

UserSchema.methods.unblockUser = function(userId: string) {
  this.blockedUsers = this.blockedUsers.filter(id => id !== userId);
  return this.save();
};

UserSchema.methods.isFriendWith = function(userId: string): boolean {
  return this.friends.some(f => f.userId === userId);
};

UserSchema.methods.hasBlocked = function(userId: string): boolean {
  return this.blockedUsers.includes(userId);
};

UserSchema.methods.updateOnlineStatus = function(isOnline: boolean) {
  this.isOnline = isOnline;
  this.lastActive = new Date();
  return this.save();
};

UserSchema.methods.updateBattleStats = function(result: 'win' | 'loss', damageDealt: number, difficulty: string, language: string) {
  if (result === 'win') {
    this.totalWins++;
    this.stats.currentWinStreak++;
    if (this.stats.currentWinStreak > this.stats.longestWinStreak) {
      this.stats.longestWinStreak = this.stats.currentWinStreak;
    }
  } else {
    this.totalLosses++;
    this.stats.currentWinStreak = 0;
  }
  
  this.totalDamageDealt += damageDealt;
  this.stats.totalBattles++;
  
  // Update average damage
  this.stats.averageDamagePerBattle = this.totalDamageDealt / this.stats.totalBattles;
  
  // Update difficulty stats
  if (difficulty in this.stats.battlesByDifficulty) {
    (this.stats.battlesByDifficulty as any)[difficulty]++;
  }
  
  // Update favorite language
  // This would require tracking language usage across battles
  
  return this.save();
};

// Static methods
UserSchema.statics.findByUsername = function(username: string) {
  return this.findOne({ username: new RegExp(`^${username}$`, 'i') });
};

UserSchema.statics.findOnlineFriends = function(userId: string) {
  return this.aggregate([
    { $match: { id: userId } },
    { $unwind: '$friends' },
    {
      $lookup: {
        from: 'users',
        localField: 'friends.userId',
        foreignField: 'id',
        as: 'friendData',
      },
    },
    { $unwind: '$friendData' },
    { $match: { 'friendData.isOnline': true } },
    {
      $project: {
        userId: '$friends.userId',
        username: '$friendData.username',
        elo: '$friendData.elo',
        isOnline: '$friendData.isOnline',
        lastSeen: '$friendData.lastActive',
        friendshipStarted: '$friends.friendshipStarted',
        gamesPlayedTogether: '$friends.gamesPlayedTogether',
      },
    },
  ]);
};

UserSchema.statics.findLeaderboard = function(limit = 100) {
  return this.find({ isOnline: true })
    .sort({ elo: -1, totalWins: -1 })
    .limit(limit)
    .select('username elo totalWins totalLosses avatarUrl');
};

UserSchema.statics.searchUsers = function(query: string, limit = 20) {
  return this.find({
    username: new RegExp(query, 'i'),
    preferences: { allowFriendRequests: true },
  })
  .sort({ elo: -1 })
  .limit(limit)
  .select('username elo avatarUrl isOnline');
};

UserSchema.statics.getFriendSuggestions = function(userId: string, limit = 10) {
  return this.aggregate([
    { $match: { id: { $ne: userId } } },
    { $match: { 
      'blockedUsers': { $ne: userId },
      id: { $nin: [userId] }
    }},
    { $sort: { elo: -1 } },
    { $limit: limit * 3 },
    {
      $lookup: {
        from: 'users',
        let: { currentUserId: userId },
        pipeline: [
          { $match: { $expr: { $eq: ['$id', '$$currentUserId'] } } },
          { $project: { friends: 1, blockedUsers: 1, pendingRequests: 1 } },
        ],
        as: 'currentUser',
      },
    },
    { $unwind: '$currentUser' },
    {
      $match: {
        'currentUser.friends.userId': { $ne: '$id' },
        'currentUser.blockedUsers': { $ne: '$id' },
        'currentUser.pendingRequests.fromUserId': { $ne: '$id' },
      },
    },
    { $project: { username: 1, elo: 1, avatarUrl: 1, isOnline: 1 } },
    { $limit: limit },
  ]);
};

// Export model
export const User = model<IUser>('User', UserSchema);
