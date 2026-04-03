import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    try {
      await register(username, email, password);
      navigate('/lobby');
    } catch {
      setError('Registration failed. Username or email may already be taken.');
    } finally {
      setIsLoading(false);
    }
  };

  const field = (label: string, id: string, type: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} className="input" placeholder={placeholder} required />
    </div>
  );

  return (
    <div className="scanlines" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div className="bg-grid" />
      <div className="bg-gradient-orbs" />

      <div className="z-above" style={{ width: '100%', maxWidth: 440, padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="logo-text" style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-1px' }}>
            <span>Code</span><span>Clash</span>
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.85rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Join the Arena
          </div>
        </div>

        <div className="card-glow" style={{ padding: 36 }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Create account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24 }}>
            Start at ELO 1000 and climb the ranks
          </p>

          <form onSubmit={handleSubmit}>
            {field('Username', 'username', 'text', username, setUsername, 'Your in-game name')}
            {field('Email', 'reg-email', 'email', email, setEmail, 'you@example.com')}
            {field('Password', 'reg-password', 'password', password, setPassword, '6+ characters')}
            {field('Confirm Password', 'confirm-password', 'password', confirmPassword, setConfirmPassword, 'Repeat password')}

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,48,96,0.1)', border: '1px solid rgba(255,48,96,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: '0.85rem', marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            <button id="register-btn" type="submit" disabled={isLoading} className="btn btn-cyan btn-lg" style={{ width: '100%' }}>
              {isLoading ? 'Creating account...' : 'Join the Arena →'}
            </button>
          </form>

          <div className="neon-divider" style={{ margin: '24px 0' }} />
          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Already a coder?{' '}
            <Link to="/login" style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
