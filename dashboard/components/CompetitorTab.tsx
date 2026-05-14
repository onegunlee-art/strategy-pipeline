'use client';

import { useEffect, useState } from 'react';
import { multiCompetitorWinProb, expectedScore } from '@/lib/elo';

interface Competitor { id: number; name: string; current_elo: number; match_count: number; }

interface Props { refreshKey: number; }

export default function CompetitorTab({ refreshKey }: Props) {
  const [comps, setComps] = useState<Competitor[]>([]);
  const [ourElo, setOurElo] = useState(1500);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/weights').then(r => r.json()).then(d => {
      if (d.competitors) setComps(d.competitors);
      if (d.our_elo) setOurElo(d.our_elo);
    });
  }, [refreshKey]);

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedElos = comps.filter(c => selectedIds.has(c.id)).map(c => c.current_elo);
  const matchupProb = selectedElos.length > 0 ? multiCompetitorWinProb(ourElo, selectedElos) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 우리 Elo */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        padding: '24px', display: 'flex', alignItems: 'center', gap: '24px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '2px' }}>
            OUR ELO
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '48px', color: 'var(--cyan)', marginTop: '4px' }}>
            {Math.round(ourElo)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            기준 1500 · K=32 · 매 딜 결과로 자동 업데이트
          </div>
        </div>
      </div>

      {/* 매치업 시뮬레이션 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>
          MATCHUP SIMULATOR (다중 선택)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {comps.map(c => {
            const active = selectedIds.has(c.id);
            const winProb = expectedScore(ourElo, c.current_elo);
            return (
              <button key={c.id} onClick={() => toggle(c.id)}
                style={{
                  padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                  background: active ? 'var(--cyan)' : 'var(--surface2)',
                  color: active ? '#000' : 'var(--text)',
                  border: active ? 'none' : '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start',
                }}>
                <span style={{ fontSize: '13px' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', opacity: 0.8 }}>
                    {Math.round(c.current_elo)}
                  </span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', opacity: 0.6 }}>
                    1:1 {(winProb * 100).toFixed(0)}% · {c.match_count}매치
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {matchupProb !== null && (
          <div style={{
            padding: '16px', background: 'var(--surface2)', borderRadius: '8px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)' }}>
                EXPECTED WIN PROBABILITY
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '4px' }}>
                vs {Array.from(selectedIds).length}개 경쟁사
              </div>
            </div>
            <div style={{
              fontFamily: 'IBM Plex Mono', fontSize: '36px',
              color: matchupProb >= 0.5 ? 'var(--green)' : 'var(--red)',
            }}>
              {(matchupProb * 100).toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Elo Ranking */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>
          ELO RANKING
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...comps].sort((a, b) => b.current_elo - a.current_elo).map((c, i) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px', background: 'var(--surface2)', borderRadius: '6px',
            }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-dim)', minWidth: '24px' }}>
                #{i + 1}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{c.name}</span>
              <div style={{
                flex: 2, height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${Math.min(100, (c.current_elo - 1200) / 6)}%`,
                  background: 'var(--cyan)',
                }} />
              </div>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '14px', color: 'var(--cyan)', minWidth: '50px', textAlign: 'right' }}>
                {Math.round(c.current_elo)}
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', minWidth: '40px', textAlign: 'right' }}>
                {c.match_count}전
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
