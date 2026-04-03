import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

function getEloTier(elo: number) {
  if (elo >= 2000) return { label: 'Diamond', cls: 'tier-diamond' };
  if (elo >= 1700) return { label: 'Platinum', cls: 'tier-platinum' };
  if (elo >= 1400) return { label: 'Gold', cls: 'tier-gold' };
  if (elo >= 1200) return { label: 'Silver', cls: 'tier-silver' };
  return { label: 'Bronze', cls: 'tier-bronze' };
}

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  const tier = user ? getEloTier(user.elo || 1000) : null;
  const navLinks = [
    { path: '/lobby',       label: '⚔️ Arena' },
    { path: '/leaderboard', label: '🏆 Rankings' },
    { path: '/profile',     label: '👤 Profile' },
  ];

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: scrolled
        ? 'rgba(8, 12, 20, 0.95)'
        : 'rgba(8, 12, 20, 0.7)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      transition: 'var(--transition)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link to="/lobby" style={{ textDecoration: 'none' }}>
          <div className="logo-text" style={{ fontSize: '1.3rem', fontWeight: 800 }}>
            <span>Code</span><span>Clash</span>
          </div>
        </Link>

        {/* Nav Links */}
        <div style={{ display: 'flex', gap: 4 }}>
          {navLinks.map(link => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: isActive ? 'var(--cyan)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(0,245,255,0.08)' : 'transparent',
                  borderBottom: isActive ? '2px solid var(--cyan)' : '2px solid transparent',
                  transition: 'var(--transition)',
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {tier && (
            <span className={`tier-badge ${tier.cls}`}>{tier.label}</span>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user?.username}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ELO: <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-code)' }}>
                {user?.elo || 1000}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm btn-red"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};
