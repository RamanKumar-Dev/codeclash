import React, { useState, useEffect } from 'react';

export const LeaderboardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('http://localhost:3001/leaderboard');
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-orange-600';
    return 'text-gray-400';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-green-400">🏆 Leaderboard</h1>
          <p className="text-gray-400">Top coders in the arena</p>
        </div>
      </div>

      {/* Leaderboard Content */}
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Rank</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Player</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">ELO</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Wins</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Losses</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {leaderboard.map((player, index) => {
                const winRate = player.wins + player.losses > 0 
                  ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
                  : '0.0';
                
                return (
                  <tr key={index} className="hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4">
                      <div className={`font-bold text-lg ${getRankColor(index + 1)}`}>
                        {getRankIcon(index + 1)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{player.username}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-green-400">{player.elo}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-green-400">{player.wins}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-red-400">{player.losses}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-300">{winRate}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {leaderboard.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No battles fought yet</div>
            <div className="text-gray-500 mt-2">Be the first to compete!</div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.history.back()}
            className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg transition duration-200"
          >
            ← Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
};
