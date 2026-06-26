'use client';

import { useState, useRef } from 'react';
import type { IntelItem } from '../api/market-research/route';

interface Analysis3C {
  company: { strengths: string[]; positioning: string };
  customer: { needs: string[]; eval_criteria: string[] };
  competitors: { name: string; strategy: string; strengths: string[]; weaknesses: string[] }[];
}

interface SWOT {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface Opportunity {
  key_opportunities: string[];
  differentiation: string[];
  strategy: string;
}

interface AnalysisResult {
  newsItems: IntelItem[];
  analysis_3c: Analysis3C;
  swot: SWOT;
  opportunity: Opportunity;
}

type Tab = 'news' | '3c' | 'swot' | 'opportunity';

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' } as React.CSSProperties,
  header: {
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    position: 'sticky' as const, top: 0, zIndex: 100,
    padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  } as React.CSSProperties,
  content: { maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' } as React.CSSProperties,
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '6px', padding: '20px',
  } as React.CSSProperties,
  input: {
    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '4px',
    padding: '8px 12px', fontSize: '14px', color: 'var(--text)', width: '100%', boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
  textarea: {
    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '4px',
    padding: '8px 12px', fontSize: '14px', color: 'var(--text)', width: '100%', boxSizing: 'border-box' as const,
    outline: 'none', resize: 'vertical' as const, minHeight: '80px',
  } as React.CSSProperties,
  label: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', display: 'block', fontWeight: 600 } as React.CSSProperties,
  chip: (active?: boolean) => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: active ? 'var(--brand-mid)' : 'var(--surface2)',
    border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
    borderRadius: '20px', padding: '4px 12px', fontSize: '13px', color: 'var(--text)',
    cursor: 'pointer',
  }) as React.CSSProperties,
  btn: (variant: 'primary' | 'secondary' | 'ghost' = 'primary') => ({
    padding: '8px 20px', borderRadius: '4px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
    background: variant === 'primary' ? 'var(--brand)' : variant === 'secondary' ? 'var(--surface2)' : 'transparent',
    color: variant === 'primary' ? '#fff' : 'var(--text)',
    border: variant === 'secondary' ? '1px solid var(--border)' : 'none',
  }) as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600, color: active ? 'var(--brand)' : 'var(--text-dim)',
    borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
    fontFamily: 'inherit',
  }) as React.CSSProperties,
  list: { listStyle: 'none', padding: 0, margin: 0 } as React.CSSProperties,
  listItem: { padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '14px' } as React.CSSProperties,
};

const DEFAULT_COMPETITORS = ['LG CNS', 'Samsung SDS', 'SK C&C'];

const DEMO_INTEL: IntelItem[] = [
  { date: '2025-11', category: '자사강점', subject: 'KT', title: 'KT, 국방통합데이터센터(DIDC) 운영 5년 누적 인프라 역량 공개', keywords: 'DIDC, 국방 인프라, 클라우드', content: 'KT가 국방통합데이터센터(DIDC) 구축·운영 5년의 경험을 바탕으로 보안 클라우드 인프라 역량을 공개했다. 국방 전용 네트워크와 K-RMF 실증 경험을 보유한 유일한 통신사로, 국방 AI 플랫폼 사업 수주 경쟁에서 유리한 고지를 점하고 있다는 평가다.', source: '전자신문', link: '' },
  { date: '2025-10', category: '자사강점', subject: 'KT', title: 'KT, 오픈 컨소시엄 전략으로 국방 AI 사업 입찰 준비… 벤더 중립성 차별화', keywords: '오픈 컨소시엄, 벤더 중립성, 국방 AI', content: 'KT가 특정 AI 플랫폼에 종속되지 않는 오픈 컨소시엄 전략을 앞세워 국방부 AI 플랫폼 사업 입찰을 준비하고 있다. 전문 AI 솔루션 공급사와 사전 협력 체계를 구성해 Full-Stack 부재를 유연성으로 전환하겠다는 구상이다.', source: 'ZDNet Korea', link: '' },
  { date: '2025-09', category: '자사약점', subject: 'KT', title: 'KT AI 사업, 자체 LLM 라인업 부재로 국방 공공 시장 경쟁력 의문', keywords: 'Full-Stack 부재, LLM, AI 플랫폼', content: 'KT가 자체 AI 플랫폼과 LLM 풀 라인업을 갖추지 못해 국방 공공 AI 시장에서 경쟁사 대비 불리하다는 평가가 나오고 있다. 경쟁사들이 자체 GenAI 플랫폼을 앞세워 제안을 완료한 반면, KT는 외부 협력사 의존도가 높다는 지적이다.', source: '디지털데일리', link: '' },
  { date: '2025-08', category: '자사약점', subject: 'KT', title: 'KT, 국방 고객 마케팅 취약… 조달 네트워크 경쟁사 대비 열세', keywords: '고객 마케팅, 조달청, 영업 조직', content: '5년간 통신 장애 사고 등 14건의 대형 피해로 KT 브랜드 이미지 회복이 과제로 남아 있다. 국방 영업 전담 조직이 경쟁사 대비 소규모로 운영되고 있어 지역 조달청 고객 마케팅에서 열세라는 분석이 있다.', source: '아이뉴스24', link: '' },
  { date: '2025-11', category: '경쟁사강점', subject: 'LG CNS', title: 'LG CNS, 국방부 DIDC 데이터·AI 플랫폼 사업 독점 수주… ExaOne 국방 특화 적용', keywords: 'DIDC, ExaOne, AI 플랫폼, 독점', content: 'LG CNS가 국방통합데이터센터(DIDC) 기반 AI 플랫폼 구축 사업을 단독 수주했다. 자체 GenAI 플랫폼 DAP GenAI와 AgenticWorks를 적용하며, ExaOne 국방 특화 파인튜닝 모델도 함께 공급해 국방 AI 생태계 독점 구조를 강화하고 있다.', source: '연합뉴스', link: '' },
  { date: '2025-10', category: '경쟁사강점', subject: 'LG CNS', title: 'LG CNS·LG유플러스 Alliance, 국방 IT 사업 전담 조직 25년 인력 보강 완료', keywords: 'Alliance, 국방 IT, 전담 조직', content: 'LG CNS와 LG유플러스가 국방 IT 아웃소싱 시장 선점을 위해 전담 제안 조직을 확대하고 사전 영업을 완료했다. 25년도에 국방 전문 인력을 대폭 보강해 27~30년 국방부 전략 사업 수주를 목표로 하고 있다.', source: '조선비즈', link: '' },
  { date: '2025-07', category: '경쟁사약점', subject: 'LG CNS', title: 'LG CNS 국방 IT 독점 구조, 고비용·낮은 유연성 지적… 고객사 대안 모색', keywords: '독점 구조, 고비용, 유연성', content: 'LG CNS의 국방 IT 독점 지위가 고비용과 기술 종속 문제를 낳고 있다는 지적이 국방부 내부에서 제기되고 있다. 신기술 도입 시 벤더 교체 유연성이 낮아 일부 사업에서 대안 사업자 검토가 이루어지고 있다는 후문이다.', source: '뉴스1', link: '' },
  { date: '2025-11', category: '경쟁사강점', subject: 'Samsung SDS', title: '삼성SDS FabriX·Brightics AI, 방위산업 AI 통합기반 구축 레퍼런스 확보', keywords: 'FabriX, Brightics AI, 방위산업, 레퍼런스', content: '삼성SDS가 방위산업 AI 통합기반 구축 사업을 수행하며 국방 도메인 레퍼런스를 쌓고 있다. FabriX 플랫폼과 Brightics AI 기반 Full-Stack 솔루션으로 국가AI컴퓨팅 센터 연동 추진 중이며, 국방 AI R&D 조직도 신설했다.', source: '디지털데일리', link: '' },
  { date: '2025-06', category: '경쟁사약점', subject: 'Samsung SDS', title: '삼성SDS, 1400억대 국세청 정보화 사업 비리 연루… 국방 사업 신뢰도 영향 우려', keywords: '비리, 신뢰도, 국세청 사업', content: '삼성SDS 직원이 국세청 정보화 사업 입찰 비리에 연루되어 검찰 수사를 받고 있다. 14억원대 금품 수수 혐의로 국방 공공 사업에서의 삼성SDS 신뢰도에 영향을 줄 수 있다는 분석이 나오고 있다.', source: 'SBS Biz', link: '' },
  { date: '2025-11', category: '경쟁사강점', subject: 'SKT', title: 'SKT, 국방부 AX 전략 TF 통해 목적모델 개발·MOU 체결… 에이전트 선도 포지션', keywords: 'AX 목적모델, 에이전트, MOU', content: 'SKT가 국방부 AX 전략 TF를 통해 국방 특화 LLM 목적모델 개발에 착수하고 MOU를 체결했다. LLM 기반 에이전트 솔루션을 선도하며 국방 모바일 환경 AI 적용 실증을 진행 중이다.', source: '전자신문', link: '' },
  { date: '2025-08', category: '경쟁사약점', subject: 'SKT', title: 'SKT, AI 에이전트 사업 집중으로 인프라·운영 역량 약화… 단독 Full-Stack 제안 한계', keywords: 'Full-Stack 부재, 인프라, 운영 역량', content: 'SKT가 AI 에이전트와 목적모델 특화에 집중하면서 인프라 구축·운영 역량이 경쟁사 대비 약하다는 평가다. 국방 사업에서 Full-Stack 단독 제안이 어려워 컨소시엄 구성이 불가피하며, 파트너 선정에 따라 경쟁력이 좌우될 전망이다.', source: '아이뉴스24', link: '' },
];

const DEMO_DATA = {
  projectName: '국방 AI·데이터 맞춤형 플랫폼 구축 사업',
  customerName: '국방부 (KCCS)',
  businessDesc: 'AI 챗봇·목적모델 구축, 데이터 자산화, DIDC 기반 국방 AI 플랫폼 고도화. 기술 80% / 가격 20% 평가. 27~30년 국방부 전략 사업 집중 투자 예상.',
  competitors: ['LG CNS', 'Samsung SDS', 'SKT'],
  result: {
    newsItems: DEMO_INTEL,
    analysis_3c: {
      company: {
        strengths: ['DIDC 인프라 구축·운영 경험', 'K-RMF 실증 경험', '오픈 컨소시엄 구성 유연성', '국방 전담 조직 보강 중'],
        positioning: 'DIDC 인프라 구축·운영 경험과 목표 데이터 공급 사업 수행 이력을 바탕으로, 특정 기술에 종속되지 않는 유연한 오픈 컨소시엄 구성이 가능한 플레이어. Full-Stack 부재를 벤더 중립성 강점으로 전환하는 프레임워크 전략이 핵심.',
      },
      customer: {
        needs: ['국방 특화 AI 목적모델 구축', '데이터 보안·자산화', '기존 시스템과의 통합 운영', '지속 가능한 유지보수 체계'],
        eval_criteria: ['국방 레퍼런스 및 보안 적합성', 'AI 플랫폼 자체 역량', 'Full-Stack 솔루션 제공 여부', '컨소시엄 안정성 및 납기'],
      },
      competitors: [
        { name: 'LG CNS', strategy: '국방 IT 독점 지위 유지 + ExaOne 국방 특화 모델로 Full 라인업 제안', strengths: ['국방 IT 독점 레퍼런스', '자체 AI 플랫폼(ExaOne/DAP GenAI)', 'Full 라인업 솔루션'], weaknesses: ['고비용 독점 구조', '신기술 유연성 낮음'] },
        { name: 'Samsung SDS', strategy: 'FabriX·Brightics AI 기반 Full 라인업 + 국가AI컴퓨팅 센터 레퍼런스 활용', strengths: ['방위산업 AI 통합 레퍼런스', '자체 AI·데이터 플랫폼', '삼성 그룹 신뢰도'], weaknesses: ['국방 특화 인력 부족', '단독 제안 시 가격 열위'] },
        { name: 'SKT', strategy: 'LLM 에이전트·목적모델 특화, MOU 기반 사전 영업 완료로 조기 선점', strengths: ['국방 AX 목적모델 역량', '에이전트 솔루션 선도', 'MOU 기반 사전 영업'], weaknesses: ['인프라·운영 역량 약함', 'Full-Stack 단독 제안 불가'] },
      ],
    },
    swot: {
      strengths: ['DIDC 인프라 구축·운영 경험', 'K-RMF 실증 경험 보유', '오픈 컨소시엄 구성 유연성', '국방 전담 조직 보강 중'],
      weaknesses: ['AI Full-Stack 라인업 부재', '국내 AI 인지도(레퍼런스) 열위', '지역 조달 고객 마케팅 취약', '제안 전담 조직 미흡'],
      opportunities: ['특정 기술 독점 없는 유연 플랫폼 수요 증가', '27~30년 KCCS 포함 국방부 전략 사업 집중 투자', 'Alliance & 제안 전담 공조 체계 구축 가능', '오픈 컨소시엄으로 벤더 중립성 어필 가능'],
      threats: ['LG CNS Full 라인업 단독 제안 가능', '삼성SDS·SKT Alliance 제안준비 완료', '25년 국방 인력 보강(LG·삼성)', '방산 AI 사업 독점 구조 고착화 우려'],
    },
    opportunity: {
      key_opportunities: ['특정 기술 독점이 없는 유연한 국방 맞춤형 플랫폼 전환 수요', 'KT중심 오픈 컨소시엄으로 벤더 중립성 확보', '27~30년 국방부 전략 사업 집중 투자 시기 선점', 'DIDC 운영 경험 기반 신뢰성 레퍼런스 활용'],
      differentiation: ['KT중심 오픈 컨소 제안 (단일 벤더 독점 탈피)', '기술 세미나·검증 솔루션 적용 (KT+전문 솔루션 공급사 협력)', '수행조직 내 국방 전문 인력 공조 (전문 협력사 사전 확보)', '국방 전제 제안/인력 집중 보강 및 영업 조직 간공조 합의'],
      strategy: "기존 'Full-Stack 솔루션 부재'라는 약점을 '특정 기술 독점이 없는 유연한 국방 맞춤형 플랫폼'이라는 강점으로 프레임워크 전환. KT중심 오픈 컨소시엄을 구성해 기술 자유도와 고객 맞춤성을 앞세우고, DIDC 운영 레퍼런스와 국방 전담 인력 보강을 통해 신뢰도를 높여 27~30년 집중 투자 사업을 선점한다.",
    },
  } as AnalysisResult,
};

const CATEGORY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  '자사강점': { bg: 'rgba(34,197,94,0.08)', color: '#16a34a', border: '#22c55e' },
  '자사약점': { bg: 'rgba(230,0,28,0.08)', color: '#cc2222', border: '#e6001c' },
  '경쟁사강점': { bg: 'rgba(59,130,246,0.08)', color: '#1d4ed8', border: '#3b82f6' },
  '경쟁사약점': { bg: 'rgba(245,158,11,0.08)', color: '#b45309', border: '#f59e0b' },
};

export default function MarketResearchPage() {
  const [projectName, setProjectName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [businessDesc, setBusinessDesc] = useState('');
  const [competitors, setCompetitors] = useState<string[]>(DEFAULT_COMPETITORS);
  const [competitorInput, setCompetitorInput] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('news');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'ppt' | 'excel' | null>(null);
  const resultRef = useRef<AnalysisResult | null>(null);

  const loadDemo = () => {
    setProjectName(DEMO_DATA.projectName);
    setCustomerName(DEMO_DATA.customerName);
    setBusinessDesc(DEMO_DATA.businessDesc);
    setCompetitors(DEMO_DATA.competitors);
    setResult(DEMO_DATA.result);
    resultRef.current = DEMO_DATA.result;
    setActiveTab('news');
    setError('');
  };

  const addCompetitor = () => {
    const v = competitorInput.trim();
    if (v && !competitors.includes(v)) {
      setCompetitors(prev => [...prev, v]);
    }
    setCompetitorInput('');
  };

  const removeCompetitor = (c: string) => {
    setCompetitors(prev => prev.filter(x => x !== c));
  };

  const handleAnalyze = async () => {
    if (!competitors.length) { setError('경쟁사를 1개 이상 입력하세요.'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/market-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, customerName, businessDesc, competitors }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '분석 실패');
      setResult(data);
      resultRef.current = data;
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'ppt' | 'excel') => {
    if (!result) return;
    setExporting(type);
    try {
      const res = await fetch('/api/market-research/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, projectName, customerName, businessDesc, competitors, ...result }),
      });
      if (!res.ok) throw new Error('Export 실패');
      const blob = await res.blob();
      const ext = type === 'ppt' ? 'pptx' : 'xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'AI_Market_Research'}_수주전략.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kt-logo.jpg" alt="KT" style={{ height: '22px' }} />
          <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>수주전략</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>AI Market Research</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={loadDemo}
            style={{ fontSize: '12px', color: 'var(--brand)', background: 'rgba(230,0,28,0.06)', border: '1px solid var(--brand)', borderRadius: '2px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
          >
            데모 보기
          </button>
          <a href="/" style={{ fontSize: '12px', color: 'var(--text-dim)', textDecoration: 'none', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '2px' }}>
            ← 메인으로
          </a>
        </div>
      </header>

      <main style={S.content}>
        <div style={{ ...S.card, marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700 }}>시장 분석 입력</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={S.label}>사업명</label>
              <input style={S.input} placeholder="예: 차세대 금융 클라우드 구축" value={projectName} onChange={e => setProjectName(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>고객사</label>
              <input style={S.input} placeholder="예: 하나은행" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>사업 내용 / RFP 핵심 요구사항</label>
            <textarea style={S.textarea} placeholder="예: 기술 80%, 가격 20% 평가. 클라우드 네이티브 전환, AI 기반 이상거래탐지 요구. 3년간 운영 포함." value={businessDesc} onChange={e => setBusinessDesc(e.target.value)} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={S.label}>경쟁사</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              {competitors.map(c => (
                <span key={c} style={S.chip()}>
                  {c}
                  <button onClick={() => removeCompetitor(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '0 2px', fontSize: '14px', lineHeight: 1 }}>✕</button>
                </span>
              ))}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input style={{ ...S.input, width: '140px' }} placeholder="+ 경쟁사 추가" value={competitorInput} onChange={e => setCompetitorInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCompetitor(); } }} />
                <button style={S.btn('secondary')} onClick={addCompetitor}>추가</button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '12px', padding: '8px 12px', background: 'rgba(204,34,34,0.08)', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          <button style={{ ...S.btn('primary'), fontSize: '14px', padding: '10px 28px', opacity: loading ? 0.7 : 1 }} onClick={handleAnalyze} disabled={loading}>
            {loading ? '⏳ 분석 중...' : '🔍 분석 시작'}
          </button>
        </div>

        {result && (
          <div style={S.card}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
              {(['news', '3c', 'swot', 'opportunity'] as Tab[]).map(t => (
                <button key={t} style={S.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
                  {t === 'news' ? '📰 기사 인텔리전스' : t === '3c' ? '🔺 3C 분석' : t === 'swot' ? '📊 SWOT' : '💡 기회 분석'}
                </button>
              ))}
            </div>

            {activeTab === 'news' && <NewsTab newsItems={result.newsItems} />}
            {activeTab === '3c' && <ThreeCTab analysis={result.analysis_3c} customerName={customerName} />}
            {activeTab === 'swot' && <SwotTab swot={result.swot} />}
            {activeTab === 'opportunity' && <OpportunityTab opportunity={result.opportunity} />}

            <div style={{ display: 'flex', gap: '12px', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <button style={{ ...S.btn('primary'), opacity: exporting === 'ppt' ? 0.7 : 1 }} onClick={() => handleExport('ppt')} disabled={exporting !== null}>
                {exporting === 'ppt' ? '⏳ 생성 중...' : '📊 PPT 다운로드'}
              </button>
              <button style={{ ...S.btn('secondary'), opacity: exporting === 'excel' ? 0.7 : 1 }} onClick={() => handleExport('excel')} disabled={exporting !== null}>
                {exporting === 'excel' ? '⏳ 생성 중...' : '📋 Excel 다운로드'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function NewsTab({ newsItems }: { newsItems: IntelItem[] }) {
  const [filter, setFilter] = useState<string>('전체');
  const categories = ['전체', '자사강점', '자사약점', '경쟁사강점', '경쟁사약점'];
  const filtered = filter === '전체' ? newsItems : newsItems.filter(n => n.category === filter);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {categories.map(c => {
          const style = c !== '전체' ? CATEGORY_STYLE[c] : null;
          const isActive = filter === c;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: '4px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                fontFamily: 'inherit',
                background: isActive ? (style?.bg ?? 'var(--surface2)') : 'transparent',
                color: isActive ? (style?.color ?? 'var(--text)') : 'var(--text-dim)',
                border: `1px solid ${isActive ? (style?.border ?? 'var(--border)') : 'var(--border)'}`,
              }}
            >
              {c} {c !== '전체' && `(${newsItems.filter(n => n.category === c).length})`}
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface2)' }}>
              {['날짜', '구분', '대상', '제목', '핵심 키워드', '내용', '출처'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-dim)', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>항목 없음</td></tr>
            ) : filtered.map((item, i) => {
              const cs = CATEGORY_STYLE[item.category];
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-dim)', fontSize: '12px' }}>{item.date}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '12px' }}>{item.subject}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, minWidth: '200px' }}>{item.title}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-mid)', fontSize: '12px', whiteSpace: 'nowrap' }}>{item.keywords}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-mid)', fontSize: '12px', minWidth: '280px', lineHeight: 1.5 }}>{item.content}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-dim)' }}>{item.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThreeCTab({ analysis, customerName }: { analysis: Analysis3C; customerName: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div style={{ background: 'var(--surface2)', borderRadius: '6px', padding: '16px', border: '1px solid var(--brand)', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand)', margin: '0 0 10px 0' }}>Company — KT</h3>
        <p style={{ fontSize: '13px', color: 'var(--text)', margin: '0 0 12px 0', lineHeight: 1.6 }}>{analysis.company.positioning}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {analysis.company.strengths.map((s, i) => (
            <span key={i} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', color: '#22c55e' }}>{s}</span>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: '6px', padding: '16px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 10px 0' }}>Customer — {customerName || '고객사'}</h3>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 6px 0' }}>핵심 니즈</p>
        <ul style={S.list}>{analysis.customer.needs.map((n, i) => <li key={i} style={{ ...S.listItem, fontSize: '13px' }}>• {n}</li>)}</ul>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', margin: '12px 0 6px 0' }}>평가기준</p>
        <ul style={S.list}>{analysis.customer.eval_criteria.map((e, i) => <li key={i} style={{ ...S.listItem, fontSize: '13px' }}>• {e}</li>)}</ul>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: '6px', padding: '16px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px 0' }}>Competitors</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {analysis.competitors.map((comp, i) => (
            <div key={i} style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', margin: '0 0 4px 0' }}>{comp.name}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-mid)', margin: '0 0 6px 0' }}>{comp.strategy}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {comp.strengths.map((s, j) => <span key={j} style={{ fontSize: '11px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: '3px' }}>강점: {s}</span>)}
                {comp.weaknesses.map((w, j) => <span key={j} style={{ fontSize: '11px', background: 'rgba(230,0,28,0.1)', color: 'var(--brand)', padding: '2px 8px', borderRadius: '3px' }}>약점: {w}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SwotTab({ swot }: { swot: SWOT }) {
  const quadrants = [
    { label: 'Strengths (강점)', items: swot.strengths, color: '#22c55e', bg: 'rgba(34,197,94,0.06)' },
    { label: 'Weaknesses (약점)', items: swot.weaknesses, color: 'var(--brand)', bg: 'rgba(230,0,28,0.06)' },
    { label: 'Opportunities (기회)', items: swot.opportunities, color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
    { label: 'Threats (위협)', items: swot.threats, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {quadrants.map(q => (
        <div key={q.label} style={{ background: q.bg, border: `1px solid ${q.color}`, borderRadius: '6px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: q.color, margin: '0 0 10px 0' }}>{q.label}</h3>
          <ul style={S.list}>{q.items.map((item, i) => <li key={i} style={{ padding: '5px 0', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>• {item}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function OpportunityTab({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6', margin: '0 0 10px 0' }}>핵심 기회 요소</h3>
          <ul style={S.list}>{opportunity.key_opportunities.map((o, i) => <li key={i} style={{ padding: '6px 0', fontSize: '13px', borderBottom: '1px solid var(--border)' }}>• {o}</li>)}</ul>
        </div>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand)', margin: '0 0 10px 0' }}>KT 차별화 포인트</h3>
          <ul style={S.list}>{opportunity.differentiation.map((d, i) => <li key={i} style={{ padding: '6px 0', fontSize: '13px', borderBottom: '1px solid var(--border)' }}>• {d}</li>)}</ul>
        </div>
      </div>
      <div style={{ background: 'rgba(230,0,28,0.04)', border: '2px solid var(--brand)', borderRadius: '6px', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand)', margin: '0 0 12px 0' }}>종합 수주전략</h3>
        <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>{opportunity.strategy}</p>
      </div>
    </div>
  );
}
