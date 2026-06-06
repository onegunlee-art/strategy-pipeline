'use client';

// Pure-SVG normal-distribution curve for probability forecasting.
// mean/sigma in 0~100 scale. Shades ±1σ, marks mean, optional market marker.

interface ProbabilityDistributionProps {
  mean: number;            // 0~100
  sigma: number;           // std dev, narrows as more signals arrive
  marketValue?: number;    // comparison marker (e.g. Polymarket) 0~100
  width?: number;
  height?: number;
}

function probColor(p: number) {
  return p >= 65 ? 'var(--green)' : p >= 45 ? 'var(--yellow)' : 'var(--red)';
}

export default function ProbabilityDistribution({
  mean, sigma, marketValue, width = 260, height = 140,
}: ProbabilityDistributionProps) {
  const padL = 8, padR = 8, padTop = 18, padBottom = 22;
  const plotW = width - padL - padR;
  const plotH = height - padTop - padBottom;
  const baseY = padTop + plotH;

  const s = Math.max(2, sigma); // guard against div-by-zero / spikes
  const xToPx = (x: number) => padL + (x / 100) * plotW;
  const pdf = (x: number) => Math.exp(-((x - mean) ** 2) / (2 * s * s));

  // Sample the curve across 0..100
  const N = 100;
  const pts: { x: number; px: number; py: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 100;
    const y = pdf(x); // peak = 1 at mean
    pts.push({ x, px: xToPx(x), py: baseY - y * plotH });
  }

  const curvePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');

  // ±1σ shaded region
  const lo = Math.max(0, mean - s);
  const hi = Math.min(100, mean + s);
  const band = pts.filter(p => p.x >= lo && p.x <= hi);
  const bandPath = band.length
    ? `M ${xToPx(lo).toFixed(1)},${baseY} ` +
      band.map(p => `L ${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ') +
      ` L ${xToPx(hi).toFixed(1)},${baseY} Z`
    : '';

  const meanPx = xToPx(mean);
  const meanPy = baseY - plotH; // peak
  const meanColor = probColor(mean);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block', maxWidth: '100%' }}>
      {/* baseline */}
      <line x1={padL} y1={baseY} x2={padL + plotW} y2={baseY} stroke="var(--border)" strokeWidth="1" />

      {/* x-axis ticks 0 / 50 / 100 */}
      {[0, 50, 100].map(t => (
        <g key={t}>
          <line x1={xToPx(t)} y1={baseY} x2={xToPx(t)} y2={baseY + 4} stroke="var(--border)" strokeWidth="1" />
          <text x={xToPx(t)} y={baseY + 15} textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="IBM Plex Mono">{t}</text>
        </g>
      ))}

      {/* ±1σ shaded band */}
      {bandPath && <path d={bandPath} fill="var(--brand)" fillOpacity={0.15} />}

      {/* distribution curve */}
      <path d={curvePath} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" />

      {/* mean marker */}
      <line x1={meanPx} y1={meanPy} x2={meanPx} y2={baseY} stroke={meanColor} strokeWidth="2" />
      <circle cx={meanPx} cy={meanPy} r="3" fill={meanColor} />
      <text x={meanPx} y={meanPy - 6} textAnchor="middle" fill={meanColor} fontSize="11" fontWeight="700" fontFamily="IBM Plex Mono">
        {Math.round(mean)}%
      </text>

      {/* market comparison marker */}
      {marketValue != null && (
        <g>
          <line x1={xToPx(marketValue)} y1={padTop} x2={xToPx(marketValue)} y2={baseY}
            stroke="var(--text-dim)" strokeWidth="1.2" strokeDasharray="3,2" />
          <text x={xToPx(marketValue)} y={padTop - 4} textAnchor="middle" fill="var(--text-dim)" fontSize="8" fontFamily="IBM Plex Mono">
            시장 {Math.round(marketValue)}%
          </text>
        </g>
      )}
    </svg>
  );
}
