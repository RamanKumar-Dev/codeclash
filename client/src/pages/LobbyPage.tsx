import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [isInQueue, setIsInQueue] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    // Connect to Socket.io
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Authenticate
    newSocket.emit('authenticate', { token });

    // Socket event handlers
    newSocket.on('authenticated', (data) => {
      console.log('Authenticated as:', data);
    });

    newSocket.on('queue:joined', (data) => {
      setQueueSize(data.queueSize);
      setIsInQueue(true);
    });

    newSocket.on('match:found', (data) => {
      navigate(`/battle/${data.roomId}`);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      newSocket.close();
    };
  }, [token, navigate]);

  const handleJoinQueue = () => {
    if (!socket || !user) return;
    
    socket.emit('queue:join', { userId: user.id });
  };

  const handleLeaveQueue = () => {
    if (!socket) return;
    
    socket.emit('queue:leave');
    setIsInQueue(false);
    setQueueSize(0);
  };

  const handleLogout = () => {
    const { logout } = useAuthStore.getState();
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-green-400">Code-Clash</h1>
            <span className="text-gray-400">Arena of Algorithms</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="font-semibold">{user?.username}</div>
              <div className="text-sm text-gray-400">ELO: {user?.elo}</div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded transition duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Welcome to the Arena, <span className="text-green-400">{user?.username}</span>!
          </h2>
          <p className="text-xl text-gray-400">
            Ready to test your coding skills against real opponents?
          </p>
        </div>

        {/* Queue Status */}
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <div className="text-center">
            {isInQueue ? (
              <div>
                <div className="text-2xl font-bold text-yellow-400 mb-4">
                  Finding Opponent...
                </div>
                <div className="text-gray-300 mb-6">
                  Players in queue: {queueSize}
                </div>
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
                </div>
                <button
                  onClick={handleLeaveQueue}
                  className="mt-6 bg-red-500 hover:bg-red-600 px-6 py-3 rounded-lg transition duration-200"
                >
                  Cancel Search
                </button>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold mb-4">
                  Ready to Battle?
                </div>
                <div className="text-gray-300 mb-6">
                  Join the queue to be matched with an opponent
                </div>
                <button
                  onClick={handleJoinQueue}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-lg text-xl transition duration-200 transform hover:scale-105"
                >
                  Find Match
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">{user?.wins || 0}</div>
            <div className="text-gray-400">Wins</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-red-400 mb-2">{user?.losses || 0}</div>
            <div className="text-gray-400">Losses</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">{user?.elo || 1000}</div>
            <div className="text-gray-400">ELO Rating</div>
          </div>
        </div>

        {/* How to Play */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h3 className="text-xl font-bold mb-4 text-green-400">How to Play</h3>
          <div className="grid grid-cols-2 gap-4 text-gray-300">
            <div>
              <h4 className="font-semibold mb-2">⚔️ Battle</h4>
              <p className="text-sm">Solve coding puzzles faster than your opponent to deal damage</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">💥 Damage</h4>
              <p className="text-sm">Correct solutions deal damage based on speed and efficiency</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🏆 Victory</h4>
              <p className="text-sm">Reduce opponent's HP to 0 to win and gain ELO</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📈 Progress</h4>
              <p className="text-sm">Climb the leaderboard and prove you're the best coder</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
