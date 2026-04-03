import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/lobby');
    } catch {
      setError('Invalid email or password. Try dev@test.com / password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="scanlines" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div className="bg-grid" />
      <div className="bg-gradient-orbs" />

      <div className="z-above" style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="logo-text" style={{ fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-1px' }}>
            <span>Code</span><span>Clash</span>
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.9rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Arena of Algorithms
          </div>
        </div>

        {/* Card */}
        <div className="card-glow" style={{ padding: 36 }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 28 }}>
            Sign in to enter the arena
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(255,48,96,0.1)',
                border: '1px solid rgba(255,48,96,0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--red)',
                fontSize: '0.85rem',
                marginBottom: 16,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              id="login-btn"
              type="submit"
              disabled={isLoading}
              className="btn btn-cyan btn-lg w-full"
              style={{ width: '100%' }}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(0,245,255,0.3)', borderTopColor: 'var(--cyan)', borderRadius: '50%', animation: 'spin-ring 0.8s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Enter the Arena →'}
            </button>
          </form>

          <div className="neon-divider" style={{ margin: '24px 0' }} />

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 600 }}>
              Register now
            </Link>
          </p>

          {/* Demo hint */}
          <div style={{
            marginTop: 16,
            padding: '8px 12px',
            background: 'rgba(0,245,255,0.04)',
            border: '1px dashed rgba(0,245,255,0.2)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            fontFamily: 'var(--font-code)',
          }}>
            Demo: dev@test.com / password
          </div>
        </div>
      </div>
    </div>
  );
};
