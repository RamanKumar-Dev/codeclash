import React, { useEffect, useState } from 'react';

const SERVER_URL = 'http://localhost:3001';

interface Player {
  rank: number;
  id: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  winRate: string;
  winStreak?: number;
  tier: string;
}

function tierCls(tier: string) {
  const map: Record<string, string> = {
    Diamond: 'tier-diamond', Platinum: 'tier-platinum',
    Gold: 'tier-gold', Silver: 'tier-silver', Bronze: 'tier-bronze',
  };
  return map[tier] || 'tier-bronze';
}

const TIER_ICONS: Record<string, string> = {
  Diamond: '💎', Platinum: '🔷', Gold: '🥇', Silver: '🥈', Bronze: '🥉',
};

export const LeaderboardPage: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze'>('all');

  useEffect(() => {
    fetch(`${SERVER_URL}/leaderboard?limit=50`)
      .then(r => r.json())
      .then(data => { setPlayers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = players.filter(p => {
    const matchSearch = p.username.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || p.tier === filter;
    return matchSearch && matchFilter;
  });

  const top3 = players.slice(0, 3);
  const rest = filtered.slice(filtered.findIndex(p => p.rank > 3));

  return (
    <div className="scanlines" style={{ minHeight: '100vh', paddingTop: 80, position: 'relative' }}>
      <div className="bg-grid" />
      <div className="bg-gradient-orbs" />

      <div className="z-above" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: 8 }}>
            🏆 <span className="text-glow-gold">Global Rankings</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            The best coders in the arena
          </p>
        </div>

        {/* Podium */}
        {!loading && top3.length >= 3 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, marginBottom: 48 }}>
            {[top3[1], top3[0], top3[2]].map((p, podiumIdx) => {
              const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
              const heights = [140, 180, 120];
              const colors = ['#c0c0c0', '#ffd700', '#cd7f32'];
              const glows = ['rgba(192,192,192,0.3)', 'rgba(255,215,0,0.4)', 'rgba(205,127,50,0.3)'];
              const h = heights[podiumIdx];
              const c = colors[podiumIdx];
              return (
                <div key={p.id} style={{ textAlign: 'center', width: 200 }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      {TIER_ICONS[p.tier]} {p.tier}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: c, textShadow: `0 0 12px ${glows[podiumIdx]}` }}>
                      {p.username}
                    </div>
                    <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {p.elo} ELO
                    </div>
                  </div>
                  <div style={{
                    height: h,
                    background: `linear-gradient(180deg, ${c}22, ${c}08)`,
                    border: `2px solid ${c}60`,
                    borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 24px ${glows[podiumIdx]}`,
                    fontSize: '2.5rem',
                  }}>
                    {rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉'}
                    <div style={{ fontWeight: 900, fontSize: '1.4rem', color: c, marginTop: 4 }}>#{rank}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            id="leaderboard-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search player..."
            className="input"
            style={{ maxWidth: 200, flex: 1 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'] as const).map(t => (
              <button
                key={t}
                id={`filter-${t}`}
                onClick={() => setFilter(t)}
                className="btn btn-sm"
                style={{
                  background: filter === t ? 'rgba(0,245,255,0.15)' : 'transparent',
                  border: filter === t ? '1px solid var(--cyan)' : '1px solid var(--border-dim)',
                  color: filter === t ? 'var(--cyan)' : 'var(--text-muted)',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'all' ? 'All' : `${TIER_ICONS[t]} ${t}`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card-glow" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              Loading rankings...
            </div>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Tier</th>
                  <th>ELO</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className={p.rank <= 3 ? `rank-${p.rank}` : ''}>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-code)',
                        color: p.rank === 1 ? 'var(--gold)' : p.rank === 2 ? '#c0c0c0' : p.rank === 3 ? '#cd7f32' : 'var(--text-muted)',
                        fontWeight: p.rank <= 3 ? 800 : 400,
                      }}>
                        {p.rank <= 3 ? ['👑','🥈','🥉'][p.rank - 1] : `#${p.rank}`}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700 }}>{p.username}</span>
                    </td>
                    <td>
                      <span className={`tier-badge ${tierCls(p.tier)}`}>
                        {TIER_ICONS[p.tier]} {p.tier}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--cyan)' }}>
                        {p.elo}
                      </span>
                    </td>
                    <td><span style={{ color: 'var(--green)' }}>{p.wins}</span></td>
                    <td><span style={{ color: 'var(--red)' }}>{p.losses}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 99, overflow: 'hidden', maxWidth: 80 }}>
                          <div style={{
                            width: `${p.winRate}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: `linear-gradient(90deg, var(--green-dim), var(--green))`,
                          }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-code)' }}>
                          {p.winRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                      No players found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
