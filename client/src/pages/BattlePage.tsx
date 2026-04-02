import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useBattleStore } from '../stores/battleStore';

export const BattlePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const {
    roomId,
    puzzle,
    myHp,
    opponentHp,
    status,
    damageLog,
    timeRemaining,
    opponentName,
    winnerName,
    eloChange,
    setBattle,
    setHp,
    addDamage,
    setStatus,
    setTimeRemaining,
    setEnd,
    reset,
  } = useBattleStore();

  const [code, setCode] = useState('');
  const [languageId, setLanguageId] = useState(71); // Python
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    newSocket.on('match:found', (data) => {
      setBattle(data.roomId, data.puzzle, data.opponentName);
      setTimeRemaining(data.timeLimitSeconds);
    });

    newSocket.on('battle:countdown', (data) => {
      console.log(`Countdown: ${data.secondsLeft}`);
    });

    newSocket.on('battle:start', () => {
      setStatus('ACTIVE');
    });

    newSocket.on('battle:opponent_activity', (data) => {
      console.log(`Opponent submitted ${data.submissionCount} times`);
    });

    newSocket.on('battle:damage', (data) => {
      setHp(data.hp1, data.hp2);
      addDamage(data.attackerName, data.damage);
    });

    newSocket.on('battle:time_warning', (data) => {
      setTimeRemaining(data.secondsLeft);
    });

    newSocket.on('battle:end', (data) => {
      setEnd(data.winnerName, data.eloChange);
      setStatus('ENDED');
    });

    return () => {
      newSocket.close();
    };
  }, [token, navigate, setBattle, setTimeRemaining, setStatus, setHp, addDamage, setEnd]);

  const handleSubmitCode = async () => {
    if (!roomId || !socket || isSubmitting) return;

    setIsSubmitting(true);
    setStatus('JUDGING');

    try {
      socket.emit('battle:submit', {
        code,
        languageId,
        roomId,
      });
    } catch (error) {
      console.error('Error submitting code:', error);
    } finally {
      setIsSubmitting(false);
      setStatus('ACTIVE');
    }
  };

  const handleForfeit = () => {
    if (!roomId || !socket) return;
    socket.emit('battle:forfeit', { roomId });
  };

  const handlePlayAgain = () => {
    reset();
    navigate('/lobby');
  };

  const getHpColor = (hp: number) => {
    if (hp > 200) return 'bg-green-500';
    if (hp > 100) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getHpPercentage = (hp: number) => {
    return (hp / 300) * 100;
  };

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Finding opponent...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* HP Bars and Timer */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* My HP */}
          <div className="flex-1 mr-4">
            <div className="text-sm text-gray-400 mb-1">Your HP</div>
            <div className="bg-gray-700 rounded-full h-8 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getHpColor(myHp)}`}
                style={{ width: `${getHpPercentage(myHp)}%` }}
              />
            </div>
            <div className="text-sm mt-1">{myHp}/300</div>
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className="text-2xl font-bold">
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </div>
            <div className="text-sm text-gray-400">Time Remaining</div>
          </div>

          {/* Opponent HP */}
          <div className="flex-1 ml-4">
            <div className="text-sm text-gray-400 mb-1">{opponentName} HP</div>
            <div className="bg-gray-700 rounded-full h-8 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getHpColor(opponentHp)}`}
                style={{ width: `${getHpPercentage(opponentHp)}%` }}
              />
            </div>
            <div className="text-sm mt-1">{opponentHp}/300</div>
          </div>
        </div>
      </div>

      {/* Battle Area */}
      <div className="flex h-screen">
        {/* Puzzle Description */}
        <div className="w-1/2 bg-gray-800 p-6 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4 text-green-400">{puzzle?.title}</h2>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-gray-300">{puzzle?.description}</p>
          </div>

          {puzzle?.examples && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Examples</h3>
              {puzzle.examples.map((example, index) => (
                <div key={index} className="bg-gray-700 p-3 rounded mb-2">
                  <div className="text-sm text-gray-400">Input:</div>
                  <div className="font-mono">{example.input}</div>
                  <div className="text-sm text-gray-400 mt-2">Output:</div>
                  <div className="font-mono">{example.output}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Language</h3>
            <select
              value={languageId}
              onChange={(e) => setLanguageId(Number(e.target.value))}
              className="bg-gray-700 text-white px-4 py-2 rounded"
            >
              <option value={71}>Python</option>
              <option value={63}>JavaScript</option>
              <option value={54}>C++</option>
              <option value={62}>Java</option>
            </select>
          </div>
        </div>

        {/* Code Editor */}
        <div className="w-1/2 bg-gray-900 p-6 flex flex-col">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Write your code here..."
            className="flex-1 bg-gray-800 text-white font-mono p-4 rounded border border-gray-700 focus:border-green-400 focus:outline-none resize-none"
            disabled={status === 'JUDGING' || status === 'ENDED'}
          />

          {/* Action Buttons */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={handleSubmitCode}
              disabled={isSubmitting || status !== 'ACTIVE'}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded transition duration-200"
            >
              {isSubmitting ? 'Executing...' : 'Submit Code'}
            </button>
            <button
              onClick={handleForfeit}
              disabled={status === 'ENDED'}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded transition duration-200"
            >
              Forfeit
            </button>
          </div>
        </div>
      </div>

      {/* Battle End Overlay */}
      {status === 'ENDED' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg text-center max-w-md">
            <h2 className="text-3xl font-bold mb-4">
              {winnerName === user?.username ? (
                <span className="text-green-400">Victory!</span>
              ) : (
                <span className="text-red-400">Defeat</span>
              )}
            </h2>
            <div className="mb-6">
              <div className="text-xl mb-2">Winner: {winnerName}</div>
              <div className="text-lg">ELO Change: {eloChange > 0 ? '+' : ''}{eloChange}</div>
            </div>
            <button
              onClick={handlePlayAgain}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded transition duration-200"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Damage Toasts */}
      <div className="fixed top-20 right-4 space-y-2">
        {damageLog.slice(-3).map((log) => (
          <div
            key={log.id}
            className="bg-red-500 text-white px-4 py-2 rounded animate-pulse"
          >
            {log.attackerName} dealt {log.damage} damage!
          </div>
        ))}
      </div>
    </div>
  );
};
