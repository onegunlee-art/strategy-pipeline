'use client';

import { useState } from 'react';
import PillarInputTab from '@/components/PillarInputTab';
import EnsembleAnalysisTab from '@/components/EnsembleAnalysisTab';
import PortfolioTab from '@/components/PortfolioTab';
import ScenarioCompare from '@/components/ScenarioCompare';
import { PillarId, SubFactorId, SubScores, defaultSubScores } from '@/lib/pillars';

type Tab = 'pillar' | 'analysis' | 'compare' | 'portfolio';

interface PredictResult {
  deal_id: number;
  probability: number;
  method_probs: { pillar: number; bayesian: number; elo: number; monteCarlo: number };
  pillar_scores: Record<PillarId, number>;
  confidence_interval: { low: number; high: number };
  mc_distribution: number[];
  weaknesses: Array<{ id: SubFactorId; label: string; pillar: PillarId; score: number; contribution: number }>;
  prior_base_rate: number;
  data_points: number;
  client_name: string;
  deal_size: string;
  competitors: string[];
  sub_scores: SubScores;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'pillar',    label: 'Pillar 진단'  },
  { id: 'analysis',  label: '확률 & 전략'  },
  { id: 'compare',   label: '시나리오 비교' },
  { id: 'portfolio', label: '데이터'       },
];

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('pillar');
  const [result, setResult] = useState<PredictResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleResult = (data: PredictResult) => {
    setResult(data);
    setTab('analysis');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100,
        padding: '0 40px',
      }}>
        <div style={{
          maxWidth: '1280px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: '64px',
        }}>
          {/* 좌: 로고 + 브랜드명 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kt-logo.jpg" alt="KT" style={{ height: '28px', display: 'block' }} />
            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600,
              color: 'var(--text)', letterSpacing: '0',
            }}>
              WIN-RATIO ENGINE
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '2px' }}>
              v0.3 · 4-Pillar × 4-Method
            </span>
          </div>

          {/* 우: 확률 표시 + Admin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {result && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>최신 확률</span>
                <span style={{
                  fontFamily: 'var(--font-num)', fontSize: '14px', fontWeight: 600,
                  color: result.probability >= 70 ? 'var(--green)'
                       : result.probability >= 45 ? 'var(--yellow)' : 'var(--red)',
                }}>
                  {result.probability.toFixed(1)}%
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  ({result.confidence_interval.low.toFixed(0)}–{result.confidence_interval.high.toFixed(0)})
                </span>
              </div>
            )}
            <a href="/admin/login" style={{
              fontSize: '11px', color: 'var(--text-dim)',
              textDecoration: 'none', letterSpacing: '1px',
              padding: '5px 12px', border: '1px solid var(--border)',
              borderRadius: '2px', fontWeight: 500,
              transition: 'color 0.15s, border-color 0.15s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--brand)';
                e.currentTarget.style.borderColor = 'var(--brand)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-dim)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              ADMIN
            </a>
          </div>
        </div>
      </header>

      {/* ── 탭 네비게이션 ─────────────────────────────────────────── */}
      <nav style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 40px',
        position: 'sticky', top: '64px', zIndex: 99,
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  padding: '0 20px', height: '44px',
                  border: 'none', borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer',
                  fontSize: '13px', fontFamily: 'var(--font-sans)',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--brand)' : 'var(--text-dim)',
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-mid)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)'; }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── No-Go 배너 ───────────────────────────────────────────── */}
      {result && result.probability < 30 && (
        <div style={{
          background: 'rgba(204, 34, 34, 0.05)',
          borderBottom: '1px solid rgba(204, 34, 34, 0.2)',
          padding: '10px 40px',
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, color: 'var(--red)',
              letterSpacing: '1.5px', textTransform: 'uppercase',
            }}>
              NO-GO
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>
              예측 확률 {result.probability.toFixed(1)}% — Gate Review 기준 미달. 자원 재배분 검토를 권고합니다.
            </span>
          </div>
        </div>
      )}

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        padding: '6px 40px',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', fontSize: '10px', color: 'var(--text-dim)' }}>
          본 시스템은 의사결정 보조 지표이며 실제 수주를 보장하지 않습니다. Bayesian/Elo 수치는 데이터 누적에 따라 신뢰도가 개선됩니다.
        </div>
      </div>

      {/* ── 콘텐츠 ───────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 40px' }}>
        {tab === 'pillar' && <PillarInputTab onResult={handleResult} />}

        {tab === 'analysis' && (result ? (
          <EnsembleAnalysisTab result={result} onOutcome={() => setRefreshKey(k => k + 1)} />
        ) : <EmptyState label="Pillar 진단 탭에서 먼저 분석을 실행하세요" />)}

        {tab === 'compare' && (
          <ScenarioCompare initialSubs={result?.sub_scores ?? defaultSubScores()} />
        )}

        {tab === 'portfolio' && <PortfolioTab refreshKey={refreshKey} />}
      </main>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '320px', flexDirection: 'column', gap: '12px',
    }}>
      <div style={{ width: '32px', height: '1px', background: 'var(--border)' }} />
      <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>{label}</div>
    </div>
  );
}
