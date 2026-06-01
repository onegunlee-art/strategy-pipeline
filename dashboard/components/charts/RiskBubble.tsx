'use client';

// SVG risk bubble matrix: x=발생가능성, y=사업영향도, size=대응난이도

import type { Risk } from '@/lib/types';

interface RiskBubbleProps { risks: Risk[] }

const W = 300, H = 270;
const PX = { min: 44, max: W - 20 };
const PY = { min: 16, max: H - 44 };

function toSvg(v: number, axis: 'x' | 'y') {
  const n = Math.max(0, Math.min(1, v));
  if (axis === 'x') return PX.min + n * (PX.max - PX.min);
  return PY.max - n * (PY.max - PY.min);
}

function levelColor(level: string) {
  if (level === 'high') return 'var(--red)';
  if (level === 'low') return 'var(--green)';
  return 'var(--yellow)';
}

export default function RiskBubble({ risks }: RiskBubbleProps) {
  const hasData = risks.length > 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
      {/* Plot border */}
      <rect x={PX.min} y={PY.min} width={PX.max - PX.min} height={PY.max - PY.min}
        fill="none" stroke="var(--border)" strokeWidth="1" />

      {/* Danger zone (high prob + high impact) */}
      <rect x={(PX.min + PX.max) / 2} y={PY.min}
        width={(PX.max - PX.min) / 2} height={(PY.max - PY.min) / 2}
        fill="rgba(204,34,34,0.04)" />

      {/* Grid lines */}
      <line x1={(PX.min + PX.max) / 2} y1={PY.min} x2={(PX.min + PX.max) / 2} y2={PY.max}
        stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4,3" />
      <line x1={PX.min} y1={(PY.min + PY.max) / 2} x2={PX.max} y2={(PY.min + PY.max) / 2}
        stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4,3" />

      {/* Zone label */}
      <text x={PX.max - 4} y={PY.min + 12} textAnchor="end" fontSize="8" fill="rgba(204,34,34,0.6)">
        ⚠ 고위험
      </text>

      {/* Axis labels */}
      <text x={(PX.min + PX.max) / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-dim)">
        발생가능성 →
      </text>
      <text x={PX.min - 10} y={(PY.min + PY.max) / 2} textAnchor="middle" fontSize="9" fill="var(--text-dim)"
        transform={`rotate(-90, ${PX.min - 10}, ${(PY.min + PY.max) / 2})`}>
        사업영향도 →
      </text>

      {/* Axis tick labels */}
      {[0, 0.5, 1].map(v => (
        <g key={v}>
          <text x={toSvg(v, 'x')} y={PY.max + 12} textAnchor="middle" fontSize="8" fill="var(--text-dim)">
            {v}
          </text>
          <text x={PX.min - 6} y={toSvg(v, 'y') + 4} textAnchor="end" fontSize="8" fill="var(--text-dim)">
            {v}
          </text>
        </g>
      ))}

      {/* No data */}
      {!hasData && (
        <text x={(PX.min + PX.max) / 2} y={(PY.min + PY.max) / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fill="var(--text-dim)">리스크 데이터 없음</text>
      )}

      {/* Bubbles */}
      {risks.map((r, i) => {
        const cx = toSvg(r.probability, 'x');
        const cy = toSvg(r.impact, 'y');
        const radius = 8 + r.difficulty * 16;
        const color = levelColor(r.level);
        const shortName = r.name.length > 10 ? r.name.slice(0, 10) + '…' : r.name;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={radius}
              fill={`${color}22`} stroke={color} strokeWidth="1.5" />
            <text x={cx} y={cy + radius + 11} textAnchor="middle"
              fontSize="8" fill="var(--text)">
              {shortName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
