'use client';

export type BadgeKind = 'own_data' | 'ai_estimate' | 'voting';

interface Props {
  kind: BadgeKind;
  label?: string;
}

const BADGE_CONFIG: Record<BadgeKind, { icon: string; defaultLabel: string; color: string; bg: string }> = {
  own_data:    { icon: '🟢', defaultLabel: '자체 데이터',   color: '#81c784', bg: 'rgba(129,199,132,0.12)' },
  ai_estimate: { icon: '🟡', defaultLabel: 'AI 추정 (참고)', color: '#ffd54f', bg: 'rgba(255,213,79,0.12)'  },
  voting:      { icon: '🔵', defaultLabel: 'Voting',        color: '#64b5f6', bg: 'rgba(100,181,246,0.12)'  },
};

export default function ConfidenceBadge({ kind, label }: Props) {
  const cfg = BADGE_CONFIG[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 7px', borderRadius: '12px',
      background: cfg.bg, border: `1px solid ${cfg.color}33`,
      fontSize: '10px', fontFamily: 'IBM Plex Mono',
      color: cfg.color, whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }}>
      {cfg.icon} {label ?? cfg.defaultLabel}
    </span>
  );
}
