'use client';

// Pure-SVG 5-axis radar chart. scores: { S, V, D, P, E } in [0,1]

interface RadarChartProps {
  scores: Record<string, number>;  // pillar_scores from prediction (0~1)
  size?: number;
}

const PILLARS = [
  { key: 'S', label: '사전영업' },
  { key: 'V', label: 'Value Impact' },
  { key: 'D', label: '차별화' },
  { key: 'P', label: '가격경쟁력' },
  { key: 'E', label: 'Delivery' },
];

// Angles: top=−90°, then clockwise 72° each
const ANGLES = PILLARS.map((_, i) => -Math.PI / 2 + (2 * Math.PI * i) / 5);
const CX = 150, CY = 145, R = 95;

function polar(angle: number, r: number) {
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function polygonPoints(values: number[]): string {
  return values
    .map((v, i) => {
      const pt = polar(ANGLES[i], v * R);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');
}

export default function RadarChart({ scores, size = 300 }: RadarChartProps) {
  const vals = PILLARS.map(p => Math.max(0, Math.min(1, scores[p.key] ?? 0)));
  const hasData = vals.some(v => v > 0);

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg viewBox="0 0 300 290" width={size} height={size * (290 / 300)}
      style={{ display: 'block', maxWidth: '100%' }}>

      {/* Grid circles (pentagons) */}
      {gridLevels.map(lv => (
        <polygon key={lv}
          points={polygonPoints(PILLARS.map(() => lv))}
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.8"
          strokeDasharray={lv < 1 ? '3,2' : 'none'}
        />
      ))}

      {/* Axis lines */}
      {ANGLES.map((angle, i) => {
        const end = polar(angle, R);
        return (
          <line key={i}
            x1={CX} y1={CY} x2={end.x} y2={end.y}
            stroke="var(--border)" strokeWidth="0.8"
          />
        );
      })}

      {/* Data polygon */}
      {hasData && (
        <>
          <polygon
            points={polygonPoints(vals)}
            fill="rgba(26,127,60,0.15)"
            stroke="var(--green)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {vals.map((v, i) => {
            const pt = polar(ANGLES[i], v * R);
            return <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="var(--green)" />;
          })}
        </>
      )}

      {/* Empty state */}
      {!hasData && (
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-dim)" fontSize="11">데이터 없음</text>
      )}

      {/* Labels */}
      {PILLARS.map((p, i) => {
        const labelR = R + 22;
        const pt = polar(ANGLES[i], labelR);
        const score = hasData ? (vals[i] * 10).toFixed(1) : null;
        return (
          <g key={p.key}>
            <text
              x={pt.x} y={pt.y - (score ? 7 : 0)}
              textAnchor="middle" dominantBaseline="middle"
              fill="var(--text)" fontSize="10" fontWeight="600"
            >{p.key}</text>
            <text
              x={pt.x} y={pt.y + (score ? 7 : 0)}
              textAnchor="middle" dominantBaseline="middle"
              fill="var(--text-dim)" fontSize="9"
            >{score ? score : p.label}</text>
          </g>
        );
      })}

      {/* Center label */}
      {hasData && (
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-dim)" fontSize="9">
          {(vals.reduce((a, b) => a + b, 0) / vals.length * 10).toFixed(1)} avg
        </text>
      )}
    </svg>
  );
}
