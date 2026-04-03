import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

const SERVER_URL = 'http://localhost:3001';

interface Achievement { id: string; name: string; description: string; icon: string; }
interface EarnedAchievement { achievementId: string; achievementName: string; achievementIcon: string; earnedAt: string; }

function getEloTier(elo: number) {
  if (elo >= 2000) return { label: 'Diamond', cls: 'tier-diamond', icon: '💎', next: null, nextElo: null };
  if (elo >= 1700) return { label: 'Platinum', cls: 'tier-platinum', icon: '🔷', next: 'Diamond', nextElo: 2000 };
  if (elo >= 1400) return { label: 'Gold', cls: 'tier-gold', icon: '🥇', next: 'Platinum', nextElo: 1700 };
  if (elo >= 1200) return { label: 'Silver', cls: 'tier-silver', icon: '🥈', next: 'Gold', nextElo: 1400 };
  return { label: 'Bronze', cls: 'tier-bronze', icon: '🥉', next: 'Silver', nextElo: 1200 };
}

export const ProfilePage: React.FC = () => {
  const { user, token } = useAuthStore();
  const [earned, setEarned] = useState<EarnedAchievement[]>([]);
  const [definitions, setDefinitions] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${SERVER_URL}/profile/achievements`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setEarned(data.earned || []);
        setDefinitions(data.definitions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  if (!user) return null;
  const tier = getEloTier(user.elo || 1000);
  const winRate = (user.wins + user.losses) > 0
    ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
    : '0.0';
  const earnedIds = new Set(earned.map(e => e.achievementId));

  const progressToNext = tier.nextElo
    ? Math.min(100, ((user.elo - (tier.nextElo - 200)) / 200) * 100)
    : 100;

  return (
    <div className="scanlines" style={{ minHeight: '100vh', paddingTop: 80, position: 'relative' }}>
      <div className="bg-grid" />
      <div className="bg-gradient-orbs" />

      <div className="z-above" style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>

        {/* Profile Header */}
        <div className="card-glow" style={{ padding: 32, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--cyan), var(--magenta))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', fontWeight: 900, color: 'white',
            flexShrink: 0,
            boxShadow: 'var(--glow-cyan)',
          }}>
            {user.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{user.username}</h1>
              <span className={`tier-badge ${tier.cls}`}>{tier.icon} {tier.label}</span>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 12 }}>{user.email}</div>

            {/* ELO Progress bar */}
            {tier.nextElo && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>{user.elo} ELO</span>
                  <span>{tier.nextElo} → {tier.next}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-deep)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressToNext}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--cyan-dim), var(--cyan))',
                    borderRadius: 99,
                    boxShadow: '0 0 8px rgba(0,245,255,0.5)',
                    transition: 'width 1s ease',
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Wins',       value: user.wins || 0,    color: 'var(--green)' },
            { label: 'Losses',     value: user.losses || 0,  color: 'var(--red)' },
            { label: 'Win Rate',   value: `${winRate}%`,     color: 'var(--gold)' },
            { label: 'Win Streak', value: (user as any).winStreak || 0, color: 'var(--magenta)' },
          ].map(s => (
            <div key={s.label} className="card-glow" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-code)' }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Achievements */}
        <div className="card-glow" style={{ padding: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cyan)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '1px' }}>
            🏅 Achievements ({earned.length}/{definitions.length})
          </h2>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {definitions.map(def => {
                const isEarned = earnedIds.has(def.id);
                const earnedEntry = earned.find(e => e.achievementId === def.id);
                return (
                  <div key={def.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    background: isEarned ? 'rgba(255,215,0,0.06)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${isEarned ? 'rgba(255,215,0,0.3)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    opacity: isEarned ? 1 : 0.5,
                    filter: isEarned ? 'none' : 'grayscale(1)',
                  }}>
                    <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{isEarned ? def.icon : '🔒'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isEarned ? 'var(--gold)' : 'var(--text-secondary)' }}>
                        {def.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {def.description}
                      </div>
                      {isEarned && earnedEntry && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--gold)', marginTop: 4, fontFamily: 'var(--font-code)' }}>
                          ✓ {new Date(earnedEntry.earnedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
