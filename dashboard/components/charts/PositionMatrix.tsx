'use client';

// 2×2 competitive positioning scatter.
// x = 기술차별화 (0–10), y = 고객관계 (0–10)

interface Competitor { name: string; x: number; y: number; size?: string }
interface PositionMatrixProps {
  self?: { x: number; y: number };
  competitors?: Competitor[];
  selfLabel?: string;
}

const PX = { min: 44, max: 244 };  // plot area x bounds
const PY = { min: 24, max: 224 };  // plot area y bounds (SVG: larger y = lower)

function toSvg(val: number, axis: 'x' | 'y') {
  const norm = Math.max(0, Math.min(10, val)) / 10;
  if (axis === 'x') return PX.min + norm * (PX.max - PX.min);
  return PY.max - norm * (PY.max - PY.min);  // flip y
}

export default function PositionMatrix({
  self,
  competitors = [],
  selfLabel = '자사',
}: PositionMatrixProps) {
  const hasSelf = self && (self.x > 0 || self.y > 0);
  const hasData = hasSelf || competitors.length > 0;

  return (
    <svg viewBox="0 0 280 260" style={{ display: 'block', width: '100%', maxWidth: 280 }}>
      {/* Quadrant fill */}
      <rect x={PX.min} y={PY.min} width={(PX.max - PX.min) / 2} height={(PY.max - PY.min) / 2}
        fill="rgba(26,127,60,0.04)" />
      <rect x={(PX.min + PX.max) / 2} y={PY.min} width={(PX.max - PX.min) / 2} height={(PY.max - PY.min) / 2}
        fill="rgba(0,0,0,0.02)" />
      <rect x={PX.min} y={(PY.min + PY.max) / 2} width={(PX.max - PX.min) / 2} height={(PY.max - PY.min) / 2}
        fill="rgba(0,0,0,0.02)" />
      <rect x={(PX.min + PX.max) / 2} y={(PY.min + PY.max) / 2} width={(PX.max - PX.min) / 2} height={(PY.max - PY.min) / 2}
        fill="rgba(204,34,34,0.04)" />

      {/* Border */}
      <rect x={PX.min} y={PY.min} width={PX.max - PX.min} height={PY.max - PY.min}
        fill="none" stroke="var(--border)" strokeWidth="1" />

      {/* Center lines */}
      <line x1={(PX.min + PX.max) / 2} y1={PY.min} x2={(PX.min + PX.max) / 2} y2={PY.max}
        stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4,3" />
      <line x1={PX.min} y1={(PY.min + PY.max) / 2} x2={PX.max} y2={(PY.min + PY.max) / 2}
        stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4,3" />

      {/* Quadrant labels */}
      <text x={PX.min + 4} y={PY.min + 12} fontSize="9" fill="var(--text-dim)">관망</text>
      <text x={(PX.min + PX.max) / 2 + 4} y={PY.min + 12} fontSize="9" fill="var(--green)">우위</text>
      <text x={PX.min + 4} y={PY.max - 4} fontSize="9" fill="var(--text-dim)">위험</text>
      <text x={(PX.min + PX.max) / 2 + 4} y={PY.max - 4} fontSize="9" fill="var(--text-dim)">경합</text>

      {/* Axis labels */}
      <text x={(PX.min + PX.max) / 2} y={PY.max + 16} textAnchor="middle" fontSize="9" fill="var(--text-dim)">
        기술 차별화 →
      </text>
      <text x={PX.min - 12} y={(PY.min + PY.max) / 2} textAnchor="middle" fontSize="9" fill="var(--text-dim)"
        transform={`rotate(-90, ${PX.min - 12}, ${(PY.min + PY.max) / 2})`}>
        고객 관계 →
      </text>

      {/* No data state */}
      {!hasData && (
        <text x={(PX.min + PX.max) / 2} y={(PY.min + PY.max) / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fill="var(--text-dim)">데이터 없음</text>
      )}

      {/* Competitors */}
      {competitors.map((c, i) => {
        const cx = toSvg(c.x, 'x');
        const cy = toSvg(c.y, 'y');
        const r = c.size === 'large' ? 12 : c.size === 'small' ? 7 : 9;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r}
              fill="rgba(160,160,160,0.25)" stroke="var(--text-dim)" strokeWidth="1.5" />
            <text x={cx} y={cy - r - 3} textAnchor="middle" fontSize="9" fill="var(--text-mid)">
              {c.name}
            </text>
          </g>
        );
      })}

      {/* Self */}
      {hasSelf && (
        <g>
          <circle cx={toSvg(self!.x, 'x')} cy={toSvg(self!.y, 'y')} r={14}
            fill="rgba(26,127,60,0.2)" stroke="var(--green)" strokeWidth="2" />
          <text x={toSvg(self!.x, 'x')} y={toSvg(self!.y, 'y') - 18}
            textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--green)">
            {selfLabel}
          </text>
        </g>
      )}
    </svg>
  );
}
