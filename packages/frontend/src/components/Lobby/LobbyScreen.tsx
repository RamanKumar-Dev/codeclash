import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useAuthStore } from '../../stores/authStore';
import { LobbyStats, RecentBattle, NewsItem, Friend, PrivateRoom, SpectatorBattle } from '@code-clash/shared-types';

// Components
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { FindMatchButton } from './FindMatchButton';
import { OnlineFriendsList } from './OnlineFriendsList';
import { RecentBattlesList } from './RecentBattlesList';
import { NewsTicker } from './NewsTicker';
import { PrivateMatchModal } from './PrivateMatchModal';
import { SpectateModal } from './SpectateModal';
import { FriendRequestsModal } from './FriendRequestsModal';

export const LobbyScreen: React.FC = () => {
  const navigate = useNavigate();
  const socket = useSocket();
  const { user } = useAuthStore();
  
  // Store state
  const {
    stats,
    recentBattles,
    news,
    onlineFriends,
    pendingRequests,
    isLoading,
    fetchStats,
    fetchRecentBattles,
    fetchNews,
    fetchOnlineFriends,
    fetchPendingRequests,
  } = useLobbyStore();

  // Local state
  const [showPrivateMatch, setShowPrivateMatch] = useState(false);
  const [showSpectate, setShowSpectate] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [privateRoom, setPrivateRoom] = useState<PrivateRoom | null>(null);

  // Initialize data and socket listeners
  useEffect(() => {
    if (!user) return;

    // Fetch initial data
    fetchStats();
    fetchRecentBattles();
    fetchNews();
    fetchOnlineFriends();
    fetchPendingRequests();

    // Set up socket listeners
    socket?.on('lobby:stats', fetchStats);
    socket?.on('friends:request_received', fetchPendingRequests);
    socket?.on('friends:online_status', fetchOnlineFriends);
    socket?.on('lobby:queue_update', fetchStats);

    // Periodic updates
    const statsInterval = setInterval(fetchStats, 5000); // Every 5 seconds
    const friendsInterval = setInterval(fetchOnlineFriends, 10000); // Every 10 seconds

    return () => {
      socket?.off('lobby:stats', fetchStats);
      socket?.off('friends:request_received', fetchPendingRequests);
      socket?.off('friends:online_status', fetchOnlineFriends);
      socket?.off('lobby:queue_update', fetchStats);
      clearInterval(statsInterval);
      clearInterval(friendsInterval);
    };
  }, [socket, user]);

  const handleFindMatch = () => {
    navigate('/matchmaking');
  };

  const handleChallengeFriend = (friendId: string) => {
    // Open private match modal with friend pre-selected
    setShowPrivateMatch(true);
  };

  const handleSpectateBattle = (battleId: string) => {
    navigate(`/spectate/${battleId}`);
  };

  const handleCreatePrivateRoom = async (options: any) => {
    try {
      const room = await socket?.emitWithAck('private:create', options);
      setPrivateRoom(room);
      setShowPrivateMatch(false);
      navigate(`/private-room/${room.id}`);
    } catch (error) {
      console.error('Failed to create private room:', error);
    }
  };

  const handleJoinPrivateRoom = async (roomCode: string) => {
    try {
      const room = await socket?.emitWithAck('private:join', roomCode);
      navigate(`/private-room/${room.id}`);
    } catch (error) {
      console.error('Failed to join private room:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-blue-400">Code-Clash Arena</h1>
              <Badge variant="outline" className="text-green-400">
                {user.rank}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-sm text-gray-400">ELO Rating</div>
                <div className="text-xl font-bold">{user.elo}</div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-gray-400">Win Rate</div>
                <div className="text-xl font-bold">
                  {user.totalWins > 0 
                    ? `${Math.round((user.totalWins / (user.totalWins + user.totalLosses)) * 100)}%`
                    : 'N/A'
                  }
                </div>
              </div>

              {pendingRequests.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFriendRequests(true)}
                  className="relative"
                >
                  Friend Requests
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingRequests.length}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* News Ticker */}
      <NewsTicker news={news} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Main Actions */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick Actions */}
            <Card className="bg-gray-800 border-gray-700">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-6">Quick Actions</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FindMatchButton 
                    onFindMatch={handleFindMatch}
                    queueSize={stats?.queueSize || 0}
                    estimatedWaitTime={stats?.estimatedWaitTime || 0}
                  />
                  
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowPrivateMatch(true)}
                    className="h-16 flex flex-col items-center justify-center space-y-2"
                  >
                    <span className="text-2xl">👥</span>
                    <span>Challenge Friend</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowSpectate(true)}
                    className="h-16 flex flex-col items-center justify-center space-y-2"
                  >
                    <span className="text-2xl">👁</span>
                    <span>Spectate</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/leaderboard')}
                    className="h-16 flex flex-col items-center justify-center space-y-2"
                  >
                    <span className="text-2xl">🏆</span>
                    <span>Leaderboard</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gray-800 border-gray-700">
                <div className="p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {stats?.activeBattles || 0}
                  </div>
                  <div className="text-sm text-gray-400">Active Battles</div>
                </div>
              </Card>
              
              <Card className="bg-gray-800 border-gray-700">
                <div className="p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {stats?.onlineUsers || 0}
                  </div>
                  <div className="text-sm text-gray-400">Online Players</div>
                </div>
              </Card>
              
              <Card className="bg-gray-800 border-gray-700">
                <div className="p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">
                    {stats?.queueSize || 0}
                  </div>
                  <div className="text-sm text-gray-400">In Queue</div>
                </div>
              </Card>
            </div>

            {/* Featured Battle */}
            {stats?.featuredBattle && (
              <Card className="bg-gray-800 border-gray-700">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-yellow-400">⭐ Featured Battle</h3>
                    <Badge variant="outline">Live</Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{stats.featuredBattle.player1Username}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-medium">{stats.featuredBattle.player2Username}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>ELO: {stats.featuredBattle.player1Elo}</span>
                      <span>{stats.featuredBattle.puzzleTitle}</span>
                      <span>ELO: {stats.featuredBattle.player2Elo}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">👁 {stats.featuredBattle.spectatorCount} watching</span>
                        <Badge variant="outline" size="sm">
                          {stats.featuredBattle.difficulty}
                        </Badge>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => handleSpectateBattle(stats.featuredBattle!.id)}
                      >
                        Spectate
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Recent Battles */}
            <RecentBattlesList 
              battles={recentBattles}
              onViewReplay={(battleId) => navigate(`/replay/${battleId}`)}
            />
          </div>

          {/* Right Column - Friends & Social */}
          <div className="space-y-6">
            
            {/* Online Friends */}
            <OnlineFriendsList
              friends={onlineFriends}
              onChallengeFriend={handleChallengeFriend}
              onSpectateFriend={(friendId) => navigate(`/profile/${friendId}`)}
            />

            {/* Quick Stats */}
            <Card className="bg-gray-800 border-gray-700">
              <div className="p-6">
                <h3 className="text-lg font-bold mb-4">Your Stats</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Battles</span>
                    <span className="font-medium">{user.totalWins + user.totalLosses}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Win Streak</span>
                    <span className="font-medium">{user.stats?.currentWinStreak || 0}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Best Streak</span>
                    <span className="font-medium">{user.stats?.longestWinStreak || 0}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Damage</span>
                    <span className="font-medium">{user.totalDamageDealt.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Puzzles Solved</span>
                    <span className="font-medium">{user.puzzlesSolved}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gray-800 border-gray-700">
              <div className="p-6">
                <h3 className="text-lg font-bold mb-4">Quick Links</h3>
                
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate('/profile')}
                  >
                    👤 My Profile
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate('/friends')}
                  >
                    👥 Friends
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate('/settings')}
                  >
                    ⚙️ Settings
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate('/help')}
                  >
                    ❓ Help & Rules
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Modals */}
      <PrivateMatchModal
        isOpen={showPrivateMatch}
        onClose={() => setShowPrivateMatch(false)}
        onCreateRoom={handleCreatePrivateRoom}
        onJoinRoom={handleJoinPrivateRoom}
      />

      <SpectateModal
        isOpen={showSpectate}
        onClose={() => setShowSpectate(false)}
        onSpectate={handleSpectateBattle}
      />

      <FriendRequestsModal
        isOpen={showFriendRequests}
        onClose={() => setShowFriendRequests(false)}
        requests={pendingRequests}
        onAccept={(userId) => socket?.emit('friends:accept', userId)}
        onDecline={(userId) => socket?.emit('friends:decline', userId)}
      />
    </div>
  );
};
