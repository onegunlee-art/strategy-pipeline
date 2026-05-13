'use client';

import { useState } from 'react';
import PillarInputTab from '@/components/PillarInputTab';
import EnsembleAnalysisTab from '@/components/EnsembleAnalysisTab';
import MonteCarloTab from '@/components/MonteCarloTab';
import CompetitorTab from '@/components/CompetitorTab';
import PortfolioTab from '@/components/PortfolioTab';
import { PillarId, SubFactorId, SubScores, defaultSubScores } from '@/lib/pillars';

type Tab = 'pillar' | 'analysis' | 'simulator' | 'competitor' | 'portfolio';

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

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'pillar',     label: 'Pillar 진단',    short: '01' },
  { id: 'analysis',   label: '확률 & 약점',     short: '02' },
  { id: 'simulator',  label: '시나리오 (MC)',   short: '03' },
  { id: 'competitor', label: '경쟁구도 (Elo)',  short: '04' },
  { id: 'portfolio',  label: '학습 & 데이터',   short: '05' },
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
      {/* 헤더 */}
      <header style={{
        borderBottom: '1px solid var(--border)', padding: '0 32px',
        background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', color: 'var(--cyan)', fontSize: '14px', fontWeight: 600, letterSpacing: '2px' }}>
              ◈ WIN-RATIO ENGINE
            </div>
            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>v0.2 · 4-Pillar × 4-Method Ensemble</div>
          </div>
          {result && (
            <div style={{
              fontFamily: 'IBM Plex Mono', fontSize: '13px',
              color: result.probability >= 70 ? 'var(--green)' : result.probability >= 45 ? 'var(--yellow)' : 'var(--red)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>LATEST</span>
              {result.probability.toFixed(1)}%
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                ({result.confidence_interval.low.toFixed(0)}-{result.confidence_interval.high.toFixed(0)})
              </span>
            </div>
          )}
        </div>
      </header>

      {/* 탭 */}
      <nav style={{
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        padding: '0 32px', position: 'sticky', top: '56px', zIndex: 99,
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '0' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  padding: '14px 20px', border: 'none',
                  borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: active ? 'var(--cyan)' : 'var(--text-dim)' }}>
                  {t.short}
                </span>
                <span style={{ fontSize: '13px', color: active ? 'var(--text)' : 'var(--text-dim)', fontWeight: active ? 500 : 400 }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 콘텐츠 */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px' }}>
        {tab === 'pillar' && <PillarInputTab onResult={handleResult} />}

        {tab === 'analysis' && (result ? (
          <EnsembleAnalysisTab result={result} onOutcome={() => setRefreshKey(k => k + 1)} />
        ) : <EmptyState label="Pillar 진단 탭에서 먼저 분석을 실행하세요" />)}

        {tab === 'simulator' && (result ? (
          <MonteCarloTab initialSubs={result.sub_scores} baseProb={result.probability} />
        ) : <MonteCarloTab initialSubs={defaultSubScores()} baseProb={50} />)}

        {tab === 'competitor' && <CompetitorTab refreshKey={refreshKey} />}

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
      <div style={{ fontSize: '32px', opacity: 0.3 }}>◈</div>
      <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>{label}</div>
    </div>
  );
}
