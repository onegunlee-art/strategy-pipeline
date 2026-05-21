'use client';

export type BadgeKind = 'own_data' | 'ai_estimate' | 'voting';

interface Props {
  kind: BadgeKind;
  label?: string;
}

const BADGE_CONFIG: Record<BadgeKind, { dot: string; defaultLabel: string; color: string; bg: string }> = {
  own_data:    { dot: '●', defaultLabel: '자체 데이터',    color: '#1A7F3C', bg: 'rgba(26,127,60,0.08)'   },
  ai_estimate: { dot: '●', defaultLabel: 'AI 추정 (참고)', color: '#C07A00', bg: 'rgba(192,122,0,0.08)'   },
  voting:      { dot: '●', defaultLabel: 'Voting',         color: '#1565C0', bg: 'rgba(21,101,192,0.08)'  },
};

export default function ConfidenceBadge({ kind, label }: Props) {
  const cfg = BADGE_CONFIG[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 8px',
      borderRadius: '2px',
      background: cfg.bg, border: `1px solid ${cfg.color}40`,
      fontSize: '10px', fontFamily: 'var(--font-sans)',
      fontWeight: 500, letterSpacing: '0.3px',
      color: cfg.color, whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }}>
      <span style={{ fontSize: '6px' }}>{cfg.dot}</span>
      {label ?? cfg.defaultLabel}
    </span>
  );
}
