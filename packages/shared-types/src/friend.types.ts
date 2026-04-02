// Friend System Types
export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUsername: string;
  toUsername: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  respondedAt?: Date;
}

export interface Friend {
  userId: string;
  username: string;
  elo: number;
  isOnline: boolean;
  lastSeen?: Date;
  friendshipStarted: Date;
  gamesPlayedTogether: number;
}

export interface OnlineStatus {
  userId: string;
  status: 'online' | 'in_battle' | 'in_queue' | 'offline';
  lastHeartbeat: Date;
  currentBattleId?: string;
}

// Private Match Types
export interface PrivateRoom {
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
}

export interface PrivateRoomRequest {
  isRanked?: boolean;
  puzzleId?: string;
  timeLimit?: number;
}

// Spectator Mode Types
export interface SpectatorBattle {
  id: string;
  battleNumber: number; // Anonymized battle ID
  player1Username: string;
  player2Username: string;
  player1Elo: number;
  player2Elo: number;
  puzzleTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeRemaining: number;
  spectatorCount: number;
  isFeatured: boolean;
  startedAt: Date;
}

export interface SpectatorInfo {
  userId?: string;
  username: string;
  isAnonymous: boolean;
  joinedAt: Date;
}

export interface SpectatorChat {
  id: string;
  battleId: string;
  spectatorId: string;
  spectatorUsername: string;
  message: string;
  timestamp: Date;
}

// Lobby Types
export interface LobbyStats {
  activeBattles: number;
  onlineUsers: number;
  queueSize: number;
  featuredBattle?: SpectatorBattle;
}

export interface RecentBattle {
  id: string;
  opponentUsername: string;
  opponentElo: number;
  result: 'win' | 'loss';
  eloChange: number;
  puzzleTitle: string;
  duration: number;
  completedAt: Date;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  type: 'event' | 'update' | 'feature' | 'season';
  priority: 'low' | 'medium' | 'high';
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  actionUrl?: string;
}

// Enhanced Socket Events for Social Features
export interface SocialClientToServerEvents {
  // Friend events
  'friends:request': (username: string) => void;
  'friends:accept': (userId: string) => void;
  'friends:decline': (userId: string) => void;
  'friends:remove': (userId: string) => void;
  'friends:online_status': () => void;
  
  // Private match events
  'private:create': (data: PrivateRoomRequest) => void;
  'private:join': (roomCode: string) => void;
  'private:ready': (roomId: string) => void;
  'private:leave': (roomId: string) => void;
  
  // Spectator events
  'spectator:join': (battleId: string) => void;
  'spectator:leave': (battleId: string) => void;
  'spectator:chat': (battleId: string, message: string) => void;
  'spectator:toggle_anonymous': () => void;
  
  // Lobby events
  'lobby:stats': () => void;
  'lobby:recent_battles': () => void;
  'lobby:news': () => void;
}

export interface SocialServerToClientEvents {
  // Friend events
  'friends:request_received': (request: FriendRequest) => void;
  'friends:request_accepted': (friend: Friend) => void;
  'friends:online_status': (friends: Friend[]) => void;
  'friends:status_update': (userId: string, status: OnlineStatus) => void;
  
  // Private match events
  'private:room_created': (room: PrivateRoom) => void;
  'private:room_joined': (room: PrivateRoom) => void;
  'private:player_ready': (userId: string) => void;
  'private:match_starting': (countdown: number) => void;
  'private:match_cancelled': (reason: string) => void;
  
  // Spectator events
  'spectator:joined': (battleId: string, spectatorCount: number) => void;
  'spectator:left': (battleId: string, spectatorCount: number) => void;
  'spectator:chat': (chat: SpectatorChat) => void;
  'spectator:battle_list': (battles: SpectatorBattle[]) => void;
  'spectator:battle_update': (battle: SpectatorBattle) => void;
  
  // Lobby events
  'lobby:stats': (stats: LobbyStats) => void;
  'lobby:recent_battles': (battles: RecentBattle[]) => void;
  'lobby:news': (news: NewsItem[]) => void;
  'lobby:queue_update': (queueSize: number, estimatedWaitTime: number) => void;
}
