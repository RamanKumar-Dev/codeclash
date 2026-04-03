import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useBattleStore } from '../stores/battleStore';

const SERVER_URL = 'http://localhost:3001';

function getEloTier(elo: number) {
  if (elo >= 2000) return { label: 'Diamond', cls: 'tier-diamond', icon: '💎' };
  if (elo >= 1700) return { label: 'Platinum', cls: 'tier-platinum', icon: '🔷' };
  if (elo >= 1400) return { label: 'Gold', cls: 'tier-gold', icon: '🥇' };
  if (elo >= 1200) return { label: 'Silver', cls: 'tier-silver', icon: '🥈' };
  return { label: 'Bronze', cls: 'tier-bronze', icon: '🥉' };
}

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { setBattle, setTimeRemaining } = useBattleStore();
  const [isInQueue, setIsInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState<{ position: number; total: number; waitSeconds: number } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [waitTime, setWaitTime] = useState(0);
  const waitInterval = useRef<number | null>(null);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }

    const newSocket = io(SERVER_URL);
    setSocket(newSocket);
    newSocket.emit('authenticate', { token });

    newSocket.on('authenticated', () => console.log('Lobby authenticated'));

    newSocket.on('queue:joined', () => {
      setIsInQueue(true);
      setWaitTime(0);
      waitInterval.current = window.setInterval(() => setWaitTime(t => t + 1), 1000);
    });

    newSocket.on('queue:position', (data: any) => setQueuePosition(data));

    newSocket.on('match:found', (data: any) => {
      setBattle(data.roomId, data.puzzle, data.opponentName);
      setTimeRemaining(data.timeLimitSeconds || 300);
      clearInterval(waitInterval.current!);
      navigate(`/battle/${data.roomId}`);
    });

    newSocket.on('error', console.error);

    return () => {
      newSocket.close();
      clearInterval(waitInterval.current!);
    };
  }, [token]);

  const handleJoinQueue = () => {
    if (!socket || !user) return;
    socket.emit('queue:join', { userId: user.id, elo: user.elo });
  };

  const handleLeaveQueue = () => {
    if (!socket) return;
    socket.emit('queue:leave');
    setIsInQueue(false);
    setQueuePosition(null);
    setWaitTime(0);
    clearInterval(waitInterval.current!);
  };

  const tier = user ? getEloTier(user.elo || 1000) : null;
  const winRate = user && (user.wins + user.losses) > 0
    ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="scanlines" style={{ minHeight: '100vh', paddingTop: 80, position: 'relative' }}>
      <div className="bg-grid" />
      <div className="bg-gradient-orbs" />

      <div className="z-above" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>
              Welcome, <span className="text-glow-cyan">{user?.username}</span>
            </h1>
            {tier && <span className={`tier-badge ${tier.cls}`}>{tier.icon} {tier.label}</span>}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
            Your ELO: <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>{user?.elo || 1000}</span>
          </p>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
          {[
            { label: 'Wins',     value: user?.wins || 0,    color: 'var(--green)' },
            { label: 'Losses',   value: user?.losses || 0,  color: 'var(--red)' },
            { label: 'Win Rate', value: `${winRate}%`,      color: 'var(--gold)' },
            { label: 'ELO',      value: user?.elo || 1000,  color: 'var(--cyan)' },
          ].map(stat => (
            <div key={stat.label} className="card-glow" style={{ padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: stat.color, fontFamily: 'var(--font-code)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Matchmaking Box */}
        <div className="card-glow" style={{ padding: 48, textAlign: 'center', marginBottom: 40 }}>
          {isInQueue ? (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
                  Finding Opponent...
                </h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'var(--font-code)' }}>
                  Wait time: <span style={{ color: 'var(--cyan)' }}>{Math.floor(waitTime / 60)}:{String(waitTime % 60).padStart(2, '0')}</span>
                </div>
                {queuePosition && (
                  <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Position #<span style={{ color: 'var(--gold)' }}>{queuePosition.position}</span> of {queuePosition.total} in queue
                  </div>
                )}
              </div>
              <button id="cancel-queue-btn" onClick={handleLeaveQueue} className="btn btn-red btn-lg">
                Cancel Search
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚔️</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 8 }}>
                Ready to Battle?
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
                Challenge real opponents in real-time coding duels. Solve problems faster to deal damage and win ELO.
              </p>
              <button
                id="find-match-btn"
                onClick={handleJoinQueue}
                className="btn btn-cyan btn-lg btn-pulse"
                style={{ fontSize: '1.1rem', padding: '16px 48px' }}
              >
                ⚡ Find Match
              </button>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="card-glow" style={{ padding: 28 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--cyan)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '1px' }}>
            How It Works
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[
              { icon: '🔍', title: 'Smart Matchmaking', desc: 'Paired with opponents near your ELO rating for fair battles' },
              { icon: '💥', title: 'Deal Damage', desc: 'Correct solutions deal 40–120 HP. Speed and efficiency matter' },
              { icon: '🪄', title: 'Cast Spells', desc: 'Use mana to Freeze opponents, reveal Hints, or Slow their editor' },
              { icon: '📈', title: 'Gain ELO', desc: 'Win battles to climb from Bronze → Silver → Gold → Platinum → Diamond' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: 12, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
