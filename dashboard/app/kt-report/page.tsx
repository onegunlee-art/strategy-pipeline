'use client';

const FONT = "'Malgun Gothic', '맑은 고딕', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'IBM Plex Mono', 'Courier New', monospace";

export default function KtReportPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#060b14', fontFamily: FONT, color: '#e2e8f0', padding: '0 0 100px' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        strong { color: #f8fafc; }
        em { color: #94a3b8; font-style: normal; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes flow { 0%{transform:translateY(0)} 100%{transform:translateY(-4px)} }
        .live-dot { width:8px;height:8px;border-radius:50%;background:#22d3ee;
          animation:pulse 2s ease-in-out infinite;display:inline-block;margin-right:6px; }
        table { width:100%;border-collapse:collapse;font-size:13px; }
        th { background:rgba(34,211,238,0.06);color:#22d3ee;padding:9px 14px;
             text-align:left;font-size:10px;letter-spacing:1.2px;
             border-bottom:1px solid rgba(34,211,238,0.18);font-family:${MONO}; }
        td { padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.04);
             line-height:1.6;vertical-align:top; }
        tr:hover td { background:rgba(255,255,255,0.02); }
        ul { padding-left:20px;line-height:2.1; }
        li { margin-bottom:2px; }
        @media print { body { background:white;color:#1e293b; } }
      `}</style>

      {/* ─── HERO ─── */}
      <div style={{
        background: 'linear-gradient(180deg, #0d1829 0%, #060b14 100%)',
        borderBottom: '1px solid rgba(34,211,238,0.12)',
        padding: '72px 24px 64px', textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid decoration */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(rgba(34,211,238,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.5) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
            borderRadius: 20, padding: '5px 14px', fontSize: 10, fontFamily: MONO,
            letterSpacing: '2px', color: '#22d3ee', marginBottom: 28,
          }}>
            <span className="live-dot" />
            INNOVATION DEMO · KT 수주전략팀 · 2026
          </div>

          <h1 style={{
            fontSize: 38, fontWeight: 800, lineHeight: 1.25, wordBreak: 'keep-all',
            color: '#f8fafc', marginBottom: 16, letterSpacing: '-1px',
          }}>
            살아있는 수주 인텔리전스를<br />
            <span style={{ color: '#22d3ee' }}>자동으로 만들 수 있다</span>
          </h1>

          <p style={{
            fontSize: 15, color: '#94a3b8', lineHeight: 1.9, wordBreak: 'keep-all',
            maxWidth: 580, margin: '0 auto 36px',
          }}>
            매일 갱신되는 정보에서 수주 확률을 자동 산출하는<br />
            <strong>멀티 에이전트 파이프라인</strong>의 컨셉 검증 데모
          </p>

          {/* Three pillars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 600, margin: '0 auto' }}>
            {[
              { label: 'Multi-Agent', sub: '파이프라인', color: '#22d3ee' },
              { label: 'Bayesian', sub: '확률 엔진', color: '#818cf8' },
              { label: 'Living', sub: '대시보드', color: '#34d399' },
            ].map(p => (
              <div key={p.label} style={{
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.color}22`,
                borderRadius: 8, padding: '14px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 17, fontWeight: 800, fontFamily: MONO, color: p.color }}>{p.label}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{p.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>

        {/* ─── SECTION 1: THE VISION ─── */}
        <Section num="01" title="혁신의 출발점 — 왜 '살아있는' 대시보드인가">
          <div style={{
            background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 8, padding: '20px 24px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: '2px', color: '#fbbf24', marginBottom: 10 }}>CORE INSIGHT</div>
            <p style={{ fontSize: 15, lineHeight: 1.95, wordBreak: 'keep-all', color: '#e2e8f0' }}>
              수주 승률은 지금 이 순간에도 변하고 있다.<br />
              경쟁사가 움직이고, 발주사 내부 정치가 바뀌고, 시장 상황이 흘러간다.<br />
              <strong>스냅샷 보고서는 이미 낡은 정보다.</strong><br />
              우리가 만들고자 하는 것은 — <strong style={{ color: '#fbbf24' }}>매일 스스로 갱신되고, 팀의 판단을 흡수하며, 확률로 말하는 살아있는 대시보드</strong>다.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: '현재 방식', items: ['담당자 경험에 의존', '판단 기준 개인차 큼', '분석 결과 일회성 소비', '승패 원인 미축적'], color: '#ef4444', badge: 'AS-IS' },
              { label: '살아있는 대시보드', items: ['매일 자동 갱신', '팀 집단지성 반영', '확률로 정량화', '피드백 루프로 지속 학습'], color: '#22d3ee', badge: 'TO-BE' },
            ].map(col => (
              <div key={col.label} style={{
                background: 'rgba(255,255,255,0.02)', border: `1px solid ${col.color}22`,
                borderRadius: 8, padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 9, fontFamily: MONO, padding: '2px 8px', borderRadius: 3, background: `${col.color}18`, color: col.color, letterSpacing: '1px' }}>{col.badge}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{col.label}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {col.items.map(i => (
                    <li key={i} style={{ fontSize: 13, color: '#94a3b8', lineHeight: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: col.color, fontSize: 10 }}>{col.badge === 'AS-IS' ? '✕' : '✓'}</span>{i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── SECTION 2: MULTI-AGENT PIPELINE ─── */}
        <Section num="02" title="멀티 에이전트 아키텍처 — 파이프라인 설계">
          <p style={{ color: '#64748b', lineHeight: 1.9, wordBreak: 'keep-all', marginBottom: 24, fontSize: 14 }}>
            살아있는 대시보드의 핵심은 <strong>5개 전문 에이전트가 분업·협업하는 파이프라인</strong>이다.
            각 에이전트는 독립적으로 실행되며, Harness가 전체를 오케스트레이션한다.
          </p>

          {/* Pipeline visualization */}
          <div style={{
            background: 'rgba(10,15,26,0.8)', border: '1px solid rgba(34,211,238,0.12)',
            borderRadius: 10, padding: '28px 24px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: '2px', color: '#475569', marginBottom: 20 }}>
              AGENT PIPELINE (실 운영 아키텍처)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                {
                  id: 'A1', name: 'Intelligence Agent', color: '#f59e0b',
                  role: '수집',
                  desc: '경쟁사 공시 · 발주사 동향 · 입찰 변수를 매일 자동 수집',
                  output: 'raw_signals[]',
                },
                {
                  id: 'A2', name: 'Alignment/Conflict Detector', color: '#22d3ee',
                  role: '분석',
                  desc: '소스 간 일치(+)/충돌(−) 지점을 추출, 드라이버 델타로 정규화',
                  output: 'driver_deltas{}',
                },
                {
                  id: 'A3', name: 'Probability Engine', color: '#818cf8',
                  role: '연산',
                  desc: 'Bayesian Posterior 수렴: P = clamp(5,95, mean(contribution(score′)) × 10)',
                  output: 'prob%, CI, σ',
                },
                {
                  id: 'A4', name: 'Strategy Agent', color: '#34d399',
                  role: '전략',
                  desc: '확률 구간별 최적 행동 전략 자동 생성 (Low/Mid/High 시나리오)',
                  output: 'action_plan[]',
                },
                {
                  id: 'A5', name: 'Report Agent', color: '#f472b6',
                  role: '발행',
                  desc: 'Weekly 시장조사 레포트 자동 발간 + 실시간 대시보드 갱신',
                  output: 'report.pdf + dashboard',
                },
              ].map((agent, i, arr) => (
                <div key={agent.id}>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 140px', gap: 16, alignItems: 'center', padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: `1px solid ${agent.color}20` }}>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: MONO, letterSpacing: '1px', color: agent.color, marginBottom: 3 }}>{agent.id} · {agent.role}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{agent.name}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{agent.desc}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 10, fontFamily: MONO, color: agent.color, background: `${agent.color}10`, padding: '3px 8px', borderRadius: 4 }}>{agent.output}</span>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', color: 'rgba(34,211,238,0.3)', fontFamily: MONO, fontSize: 14 }}>↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Harness */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(129,140,248,0.08) 0%, rgba(34,211,238,0.08) 100%)',
            border: '1px solid rgba(129,140,248,0.3)', borderRadius: 8, padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{
                minWidth: 48, height: 48, borderRadius: 8,
                background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>⚙</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#a5b4fc' }}>Harness Engineer</span>
                  <span style={{ fontSize: 9, fontFamily: MONO, padding: '2px 8px', borderRadius: 3, background: 'rgba(129,140,248,0.15)', color: '#818cf8', letterSpacing: '1px' }}>ORCHESTRATOR</span>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.9, wordBreak: 'keep-all' }}>
                  에이전트 간 실행 순서·상태·오류 복구를 관리하는 <strong style={{ color: '#c7d2fe' }}>파이프라인 오케스트레이터</strong>.
                  각 에이전트의 출력이 다음 에이전트의 입력으로 자동 연결되며,
                  실패 시 fallback 로직·재시도·알림을 처리한다.
                  팀 투표·현장 의견이 들어오면 즉시 Probability Engine을 재실행시켜
                  <strong style={{ color: '#c7d2fe' }}> 확률을 실시간으로 갱신</strong>한다.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ─── SECTION 3: DOMAIN-INVARIANT ENGINE ─── */}
        <Section num="03" title="왜 글로벌 뉴스로 검증했나 — 도메인 불변 엔진">
          <div style={{
            background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 8, padding: '18px 20px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: '2px', color: '#22d3ee', marginBottom: 12 }}>TECHNICAL RATIONALE</div>
            <p style={{ fontSize: 14, lineHeight: 1.9, wordBreak: 'keep-all', color: '#cbd5e1' }}>
              <strong>실제 Winning Ratio 대시보드는 글로벌 뉴스를 쓰지 않는다.</strong><br />
              글로벌 뉴스는 수주 데이터가 없는 지금, 엔진의 수학적 타당성을 증명하기 위한
              <strong> 대리 시험장(proxy testbed)</strong>으로 선택됐다.
            </p>
          </div>

          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.9, wordBreak: 'keep-all', marginBottom: 16 }}>
            수주 환경과 글로벌 뉴스는 <strong style={{ color: '#e2e8f0' }}>동일한 수학 문제 구조</strong>를 공유한다.
          </p>

          <table style={{ marginBottom: 20 }}>
            <thead><tr>
              <th>수주 환경 (실 운영)</th>
              <th>글로벌 뉴스 (데모)</th>
              <th style={{ textAlign: 'center' }}>동형성</th>
            </tr></thead>
            <tbody>
              {[
                ['매일 입찰 변수·경쟁 구도 변동', '매일 새 기사 생성', '✓'],
                ['영업·기술·경쟁사 견해 상충', '매체별 상충 견해 (FA↔FT↔Economist)', '✓'],
                ['정답 없음 → 확률 추정 필요', '미래 사건 → 확률 추정', '✓'],
                ['신호 누적 → 판단 수렴', '투표·기사 → Posterior 수렴', '✓'],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <td style={{ color: '#94a3b8' }}>{a}</td>
                  <td style={{ color: '#94a3b8' }}>{b}</td>
                  <td style={{ textAlign: 'center', color: '#22d3ee', fontFamily: MONO }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Math box */}
          <div style={{
            background: '#060b14', border: '1px solid rgba(129,140,248,0.2)',
            borderRadius: 8, padding: '20px 22px',
          }}>
            <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: '2px', color: '#818cf8', marginBottom: 16 }}>PROBABILITY ENGINE — 실제 수식</div>
            {[
              { label: '① 드라이버 기여도', code: 'contribution(d) = d.invert ? (10 − score) : score', note: '// 0~10, invert 축 정규화' },
              { label: '② Prior 확률', code: 'P₀ = clamp(5, 95,  round( mean(contribution) × 10 ))', note: '' },
              { label: '③ Bayesian Posterior', code: "score' = clamp(0,10,  score + Σ(δᵢ·wᵢ) / (κ + Σwᵢ))", note: '// κ=10 (AI prior = 10표)' },
              { label: '④ 신뢰구간 수렴', code: 'σ = σ₀ / √(1 + n/3)', note: '// n = 누적 신호 수' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#475569', fontFamily: MONO, marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: '#e2e8f0' }}>
                  {item.code}
                  {item.note && <span style={{ color: '#334155', marginLeft: 8 }}>{item.note}</span>}
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(129,140,248,0.15)',
              fontSize: 13, color: '#a5b4fc', lineHeight: 1.8, wordBreak: 'keep-all',
            }}>
              <strong style={{ color: '#c7d2fe' }}>핵심:</strong> 위 수식 어디에도 &ldquo;뉴스&rdquo;라는 단어가 없다.
              입력은 오직 <strong style={{ color: '#c7d2fe' }}>(드라이버 점수, 일치/충돌 가중 델타)</strong>뿐.
              → 입력 소스를 교체해도 엔진은 동일하게 작동한다.
            </div>
          </div>
        </Section>

        {/* ─── SECTION 4: DEMO → PRODUCTION ─── */}
        <Section num="04" title="데모 → 프로덕션 — 무엇이 바뀌고 무엇이 그대로인가">
          <table style={{ marginBottom: 16 }}>
            <thead><tr>
              <th>구성 요소</th>
              <th>현재 데모</th>
              <th>실 운영</th>
              <th style={{ textAlign: 'center' }}>변경 필요</th>
            </tr></thead>
            <tbody>
              {[
                ['Intelligence Agent 입력', '글로벌 뉴스 RAG', '수실주 보고서·경쟁사 DB·발주사 정보', '데이터 소스만'],
                ['드라이버 5축 정의', '외교·군사·경제·국내·외부', '기술력·가격경쟁력·관계·레퍼런스·리스크', '라벨만'],
                ['Alignment/Conflict Detector', '매체 간 보도 상충 감지', '영업·기술·인텔리전스 상충 감지', '없음 ✓'],
                ['Probability Engine (수식)', 'Bayesian Posterior', 'Bayesian Posterior', '없음 ✓'],
                ['Harness 오케스트레이션', '데모 스케줄', '일별/주별 자동 실행', '스케줄만'],
                ['Report Agent', '세션 리포트 발행', 'Weekly 시장조사 레포트 자동 발간', '템플릿만'],
                ['투표·집단지성', '데모 참여자', '수주팀·BD팀·임원', '권한 설정만'],
              ].map(([comp, demo, prod, change]) => (
                <tr key={comp}>
                  <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{comp}</td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>{demo}</td>
                  <td style={{ color: '#94a3b8' }}>{prod}</td>
                  <td style={{ textAlign: 'center', fontSize: 12, color: change.includes('없음') ? '#34d399' : '#fbbf24', fontFamily: MONO }}>{change}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{
            background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 6, padding: '12px 16px', fontSize: 13, color: '#6ee7b7',
            wordBreak: 'keep-all', lineHeight: 1.8,
          }}>
            → 에이전트 파이프라인 코드·확률 엔진·Harness·리포트 생성 <strong>재사용률 90%+</strong>.
            핵심 알고리즘 변경 없이 <strong>데이터 소스와 드라이버 라벨만 교체</strong>하면 된다.
          </div>
        </Section>

        {/* ─── SECTION 5: ROADMAP ─── */}
        <Section num="05" title="승인 후 로드맵 — 살아있는 대시보드로">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                phase: 'Phase 1', period: '1~2개월', color: '#f59e0b',
                title: 'Intelligence 파이프라인 구축',
                items: [
                  'Intelligence Agent: 수실주 DB·경쟁사 공시·발주사 정보 수집 자동화',
                  'Harness 스케줄러: 일별 자동 실행 + 오류 복구 설정',
                  '드라이버 5축 수주 특화 재정의 + 가중치 초기 설정',
                ],
              },
              {
                phase: 'Phase 2', period: '2~3개월', color: '#22d3ee',
                title: 'Weekly 시장조사 레포트 정례화',
                items: [
                  'Report Agent: 매주 월요일 자동 발간 (확률 변동 사유 포함)',
                  '수주팀·BD팀 투표 권한 부여 → 집단지성 확률 반영',
                  '진행 입찰 건 실시간 확률 모니터링 대시보드 가동',
                ],
              },
              {
                phase: 'Phase 3', period: '3~6개월', color: '#34d399',
                title: '살아있는 대시보드 — 피드백 루프 완성',
                items: [
                  '승패 피드백 루프: 결과 → 드라이버 가중치 자동 재보정',
                  '임원 대시보드: 전체 포트폴리오 수주 확률 히트맵',
                  '경쟁사 A/B 시나리오 시뮬레이터 (What-if 분석)',
                ],
              },
            ].map(ph => (
              <div key={ph.phase} style={{
                background: 'rgba(255,255,255,0.02)', border: `1px solid ${ph.color}22`,
                borderRadius: 8, padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 9, fontFamily: MONO, padding: '3px 9px', borderRadius: 3, background: `${ph.color}15`, color: ph.color, letterSpacing: '1px' }}>{ph.phase}</span>
                  <span style={{ fontSize: 10, fontFamily: MONO, color: '#475569' }}>{ph.period}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginLeft: 4 }}>{ph.title}</span>
                </div>
                <ul style={{ paddingLeft: 18 }}>
                  {ph.items.map(item => (
                    <li key={item} style={{ fontSize: 13, color: '#94a3b8', lineHeight: 2, wordBreak: 'keep-all' }}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── FINAL STATEMENT ─── */}
        <div style={{
          marginTop: 64,
          background: 'linear-gradient(135deg, rgba(34,211,238,0.06) 0%, rgba(129,140,248,0.06) 50%, rgba(52,211,153,0.06) 100%)',
          border: '1px solid rgba(34,211,238,0.18)', borderRadius: 12, padding: '36px 40px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: '3px', color: '#22d3ee', marginBottom: 20 }}>FINAL STATEMENT</div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', lineHeight: 1.8, wordBreak: 'keep-all', maxWidth: 600, margin: '0 auto 16px' }}>
            이 데모는 끝이 아니라 시작이다.
          </p>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 2, wordBreak: 'keep-all', maxWidth: 620, margin: '0 auto' }}>
            멀티 에이전트 파이프라인이 매일 정보를 수집하고,<br />
            Bayesian 엔진이 일치·충돌 신호에서 확률을 산출하며,<br />
            Harness가 전체를 오케스트레이션한다.<br />
            팀의 판단이 실시간으로 흡수되고, 결과가 다시 가중치를 보정한다.<br />
            <strong style={{ color: '#f1f5f9' }}>승인 후 데이터 소스만 연결하면, 살아있는 수주 인텔리전스가 시작된다.</strong>
          </p>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: 'center', fontSize: 11, color: '#1e293b', fontFamily: MONO, letterSpacing: '0.5px' }}>
          본 보고서는 KT 수주전략 Winning Ratio 자동화 플랫폼 데모 내부 검토용입니다.
        </div>
      </div>
    </div>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 64 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 24 }}>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 700, color: '#22d3ee', letterSpacing: '1px', opacity: 0.6 }}>{num}</span>
        <h2 style={{ fontSize: 21, fontWeight: 700, color: '#f1f5f9', wordBreak: 'keep-all', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ borderTop: '1px solid rgba(34,211,238,0.1)', paddingTop: 24 }}>
        {children}
      </div>
    </div>
  );
}
