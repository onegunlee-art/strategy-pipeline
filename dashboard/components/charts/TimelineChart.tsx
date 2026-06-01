'use client';

// Horizontal SVG milestone timeline

import type { Milestone } from '@/lib/types';

interface TimelineChartProps {
  milestones: Milestone[];
  dueDate?: string | null;
}

const W = 440, H = 120;
const TRACK_Y = 60, X0 = 32, X1 = W - 32;

function parseDateStr(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86400000;
}

export default function TimelineChart({ milestones, dueDate }: TimelineChartProps) {
  const today = new Date();

  // Merge dueDate as milestone if not already present
  const all = [...milestones];
  if (dueDate) {
    const dd = parseDateStr(dueDate);
    if (dd && !all.find(m => parseDateStr(m.date)?.toDateString() === dd.toDateString())) {
      all.push({ date: dueDate, label: '마감', type: 'deadline' });
    }
  }

  if (all.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
        <line x1={X0} y1={TRACK_Y} x2={X1} y2={TRACK_Y} stroke="var(--border)" strokeWidth="2" />
        <text x={(X0 + X1) / 2} y={TRACK_Y + 24} textAnchor="middle" fontSize="11" fill="var(--text-dim)">
          타임라인 없음
        </text>
      </svg>
    );
  }

  const parsed = all
    .map(m => ({ ...m, d: parseDateStr(m.date) }))
    .filter(m => m.d !== null)
    .sort((a, b) => a.d!.getTime() - b.d!.getTime()) as (Milestone & { d: Date })[];

  const minD = parsed[0].d;
  const maxD = parsed[parsed.length - 1].d;
  const totalDays = Math.max(1, daysBetween(minD, maxD));

  function xPos(d: Date) {
    const frac = totalDays > 0 ? daysBetween(minD, d) / totalDays : 0.5;
    return X0 + Math.max(0, Math.min(1, frac)) * (X1 - X0);
  }

  const todayInRange = today >= minD && today <= maxD;
  const todayX = todayInRange ? xPos(today) : null;

  const typeColor = (t: string) =>
    t === 'deadline' ? 'var(--red)' :
    t === 'today' ? 'var(--brand)' :
    'var(--text-mid)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
      {/* Track */}
      <line x1={X0} y1={TRACK_Y} x2={X1} y2={TRACK_Y}
        stroke="var(--border)" strokeWidth="2" />

      {/* Today indicator */}
      {todayX !== null && (
        <g>
          <line x1={todayX} y1={TRACK_Y - 18} x2={todayX} y2={TRACK_Y + 18}
            stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="4,2" />
          <text x={todayX} y={TRACK_Y - 22} textAnchor="middle" fontSize="9" fill="var(--brand)">TODAY</text>
        </g>
      )}

      {/* Milestones */}
      {parsed.map((m, i) => {
        const x = xPos(m.d);
        const above = i % 2 === 0;
        const color = typeColor(m.type);
        const labelY = above ? TRACK_Y - 28 : TRACK_Y + 36;
        const dateY = above ? TRACK_Y - 16 : TRACK_Y + 24;

        return (
          <g key={i}>
            <line x1={x} y1={above ? TRACK_Y - 8 : TRACK_Y + 8}
              x2={x} y2={above ? TRACK_Y - 20 : TRACK_Y + 20}
              stroke={color} strokeWidth="1.5" />
            {/* Diamond */}
            <polygon
              points={`${x},${TRACK_Y - 7} ${x + 7},${TRACK_Y} ${x},${TRACK_Y + 7} ${x - 7},${TRACK_Y}`}
              fill={m.d < today ? 'var(--surface2)' : color}
              stroke={color}
              strokeWidth="1.5"
            />
            <text x={x} y={dateY} textAnchor="middle" fontSize="8" fill={color}>
              {m.d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '.').replace('. ', '')}
            </text>
            <text x={x} y={labelY} textAnchor="middle" fontSize="9" fill="var(--text)">
              {m.label.length > 6 ? m.label.slice(0, 6) + '…' : m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
