import React, { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface SpellPanelProps {
  socket: Socket | null;
  roomId: string | null;
  disabled?: boolean;
}

interface SpellInfo {
  id: 'hint' | 'time_freeze' | 'slow';
  icon: string;
  label: string;
  description: string;
  manaCost: number;
  color: string;
}

const SPELLS: SpellInfo[] = [
  { id: 'hint',        icon: '💡', label: 'Hint',   description: 'Reveal a test case',        manaCost: 30, color: 'var(--gold)' },
  { id: 'time_freeze', icon: '❄️', label: 'Freeze', description: 'Freeze opponent 15s',       manaCost: 50, color: 'var(--cyan)' },
  { id: 'slow',        icon: '🌀', label: 'Slow',   description: 'Disable editor 10s',        manaCost: 40, color: 'var(--magenta)' },
];

export const SpellPanel: React.FC<SpellPanelProps> = ({ socket, roomId, disabled }) => {
  const [mana, setMana] = useState(100);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [hintText, setHintText] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('spell:cast_success', (data: { spellType: string; mana: number }) => {
      setMana(data.mana);
    });

    socket.on('spell:hint', (data: { text: string }) => {
      setHintText(data.text);
      setTimeout(() => setHintText(null), 15000);
    });

    socket.on('spell:error', (msg: string) => {
      console.warn('[Spell] Error:', msg);
    });

    return () => {
      socket.off('spell:cast_success');
      socket.off('spell:hint');
      socket.off('spell:error');
    };
  }, [socket]);

  const castSpell = useCallback((spellType: 'hint' | 'time_freeze' | 'slow') => {
    if (!socket || !roomId || disabled) return;
    const spell = SPELLS.find(s => s.id === spellType)!;
    if (mana < spell.manaCost) return;
    if (cooldowns[spellType] && Date.now() < cooldowns[spellType]) return;

    socket.emit('spell:cast', { roomId, spellType });

    // Optimistic cooldown
    const cooldownMs = spellType === 'time_freeze' ? 90000 : spellType === 'slow' ? 45000 : 60000;
    setCooldowns(prev => ({ ...prev, [spellType]: Date.now() + cooldownMs }));
    setMana(prev => Math.max(0, prev - spell.manaCost));
  }, [socket, roomId, disabled, mana, cooldowns]);

  const getCooldownText = (spellId: string) => {
    const expires = cooldowns[spellId];
    if (!expires) return null;
    const remaining = Math.ceil((expires - Date.now()) / 1000);
    return remaining > 0 ? `${remaining}s` : null;
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--radius-lg)',
      padding: 16,
    }}>
      {/* Mana Bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>🔵 MANA</span>
          <span style={{ fontFamily: 'var(--font-code)', color: '#00aaff' }}>{mana}/100</span>
        </div>
        <div className="mana-bar">
          <div className="mana-fill" style={{ width: `${mana}%` }} />
        </div>
      </div>

      {/* Spell Buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {SPELLS.map(spell => {
          const cdText = getCooldownText(spell.id);
          const canCast = !cdText && mana >= spell.manaCost && !disabled;

          return (
            <div key={spell.id} style={{ textAlign: 'center' }}>
              <button
                className="spell-btn"
                onClick={() => castSpell(spell.id)}
                disabled={!canCast}
                title={`${spell.label}: ${spell.description} (${spell.manaCost} mana)`}
                style={{ borderColor: canCast ? spell.color : undefined }}
              >
                <span style={{ fontSize: '1.4rem' }}>{spell.icon}</span>
                <span style={{ fontSize: '0.6rem', color: spell.color, fontWeight: 700 }}>
                  {spell.manaCost}MP
                </span>
                {cdText && (
                  <div className="spell-cooldown-overlay">{cdText}</div>
                )}
              </button>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {spell.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint reveal */}
      {hintText && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'rgba(255,215,0,0.1)',
          border: '1px solid rgba(255,215,0,0.3)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          color: 'var(--gold)',
          fontFamily: 'var(--font-code)',
          animation: 'toast-in 0.3s ease',
        }}>
          {hintText}
        </div>
      )}
    </div>
  );
};
