import React from 'react';

interface HpBarProps {
  current: number;
  max?: number;
  label?: string;
  reversed?: boolean; // flip bar direction for opponent
}

export const HpBar: React.FC<HpBarProps> = ({ current, max = 500, label, reversed = false }) => {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const cls = pct > 50 ? 'hp-green' : pct > 25 ? 'hp-yellow' : 'hp-red';

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: reversed ? 'flex-end' : 'flex-start',
          marginBottom: 4,
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          fontWeight: 600,
        }}>
          <span>{label}</span>
          <span style={{
            marginLeft: reversed ? 0 : 8,
            marginRight: reversed ? 8 : 0,
            fontFamily: 'var(--font-code)',
            color: pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--gold)' : 'var(--red)',
          }}>
            {current}/{max}
          </span>
        </div>
      )}
      <div className="hp-bar-wrap">
        <div
          className={`hp-bar-fill ${cls}`}
          style={{
            width: `${pct}%`,
            marginLeft: reversed ? 'auto' : 0,
            float: reversed ? 'right' : 'left',
          }}
        />
      </div>
    </div>
  );
};
