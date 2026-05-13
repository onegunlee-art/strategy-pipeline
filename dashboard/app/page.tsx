'use client';

import { useState } from 'react';
import InterviewTab from '@/components/InterviewTab';
import AnalysisTab from '@/components/AnalysisTab';
import SimulatorTab from '@/components/SimulatorTab';
import LearningTab from '@/components/LearningTab';
import { Variables } from '@/lib/algorithm';

type Tab = 'interview' | 'analysis' | 'simulator' | 'learning';

interface PredictionResult {
  probability: number;
  deal_id: number;
  variables: Variables;
  weights: Record<string, number>;
}

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'interview', label: '인터뷰 입력', short: '01' },
  { id: 'analysis', label: '분석 결과', short: '02' },
  { id: 'simulator', label: '시나리오', short: '03' },
  { id: 'learning', label: '학습 현황', short: '04' },
];

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('interview');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleResult = (data: PredictionResult) => {
    setResult(data);
    setTab('analysis');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* 헤더 */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', color: 'var(--cyan)', fontSize: '14px', fontWeight: 600, letterSpacing: '2px' }}>
              ◈ WIN-RATE
            </div>
            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>B2B 수주 예측 대시보드</div>
          </div>
          {result && (
            <div style={{
              fontFamily: 'IBM Plex Mono', fontSize: '13px',
              color: result.probability >= 70 ? 'var(--green)' : result.probability >= 45 ? 'var(--yellow)' : 'var(--red)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>LATEST</span>
              {result.probability.toFixed(1)}%
            </div>
          )}
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <nav style={{
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        padding: '0 32px', position: 'sticky', top: '56px', zIndex: 99,
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '0' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '14px 24px',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.15s',
                }}
              >
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
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px' }}>
        {tab === 'interview' && (
          <InterviewTab onResult={handleResult} />
        )}

        {tab === 'analysis' && result ? (
          <AnalysisTab
            probability={result.probability}
            variables={result.variables}
            weights={result.weights}
            dealId={result.deal_id}
            onOutcomeRecorded={() => setRefreshKey(k => k + 1)}
          />
        ) : tab === 'analysis' && (
          <EmptyState label="인터뷰 탭에서 먼저 분석을 실행하세요" />
        )}

        {tab === 'simulator' && result ? (
          <SimulatorTab initialVars={result.variables} weights={result.weights} />
        ) : tab === 'simulator' && (
          <EmptyState label="인터뷰 탭에서 먼저 분석을 실행하세요" />
        )}

        {tab === 'learning' && <LearningTab key={refreshKey} />}
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
