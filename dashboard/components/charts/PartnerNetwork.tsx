'use client';

// SVG node-link partner network diagram

import type { Partner } from '@/lib/types';

interface PartnerNetworkProps {
  partners: Partner[];
  centerLabel?: string;
}

const CX = 150, CY = 130;
const ORBIT_R = 95;

export default function PartnerNetwork({ partners, centerLabel = '자사' }: PartnerNetworkProps) {
  if (partners.length === 0) {
    return (
      <svg viewBox="0 0 300 260" style={{ display: 'block', width: '100%', maxWidth: 300 }}>
        <circle cx={CX} cy={CY} r={28} fill="rgba(230,0,28,0.08)" stroke="var(--brand)" strokeWidth="2" />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fontWeight="700" fill="var(--brand)">{centerLabel}</text>
        <text x={CX} y={CY + 50} textAnchor="middle" fontSize="10" fill="var(--text-dim)">
          파트너 데이터 없음
        </text>
      </svg>
    );
  }

  const n = partners.length;
  const nodes = partners.map((p, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      ...p,
      x: CX + ORBIT_R * Math.cos(angle),
      y: CY + ORBIT_R * Math.sin(angle),
    };
  });

  return (
    <svg viewBox="0 0 300 260" style={{ display: 'block', width: '100%', maxWidth: 300 }}>
      {/* Edges */}
      {nodes.map((nd, i) => (
        <line key={i}
          x1={CX} y1={CY} x2={nd.x} y2={nd.y}
          stroke="var(--border)" strokeWidth="1.5"
        />
      ))}

      {/* Satellite nodes */}
      {nodes.map((nd, i) => {
        return (
          <g key={i}>
            <circle cx={nd.x} cy={nd.y} r={20}
              fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
            <text x={nd.x} y={nd.y - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--text)">
              {nd.name.length > 8 ? nd.name.slice(0, 8) + '…' : nd.name}
            </text>
            <text x={nd.x} y={nd.y + 6} textAnchor="middle" fontSize="8" fill="var(--text-dim)">
              {nd.role.length > 6 ? nd.role.slice(0, 6) + '…' : nd.role}
            </text>
            {/* Role badge on edge mid-point */}
            <text
              x={(CX + nd.x) / 2}
              y={(CY + nd.y) / 2 - 4}
              textAnchor="middle" fontSize="8" fill="var(--text-dim)"
            />
          </g>
        );
      })}

      {/* Center node */}
      <circle cx={CX} cy={CY} r={28}
        fill="rgba(230,0,28,0.08)" stroke="var(--brand)" strokeWidth="2" />
      <text x={CX} y={CY - 2} textAnchor="middle" dominantBaseline="middle"
        fontSize="11" fontWeight="700" fill="var(--brand)">{centerLabel}</text>
    </svg>
  );
}
