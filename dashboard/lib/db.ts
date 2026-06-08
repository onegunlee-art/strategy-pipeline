import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL ?? '';
const isPooler = connectionString.includes('pooler.supabase.com');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  ...(isPooler ? { max: 1 } : {}),
});

let initialized = false;
let initPromise: Promise<void> | null = null;

async function runInit() {
  // 기존 v0.1 테이블 (호환 유지)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deals (
      id SERIAL PRIMARY KEY,
      client_name TEXT NOT NULL,
      deal_size TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER REFERENCES deals(id),
      variables_json TEXT NOT NULL,
      predicted_probability REAL NOT NULL,
      weights_used_json TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS outcomes (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER REFERENCES deals(id),
      actual_result INTEGER NOT NULL,
      closed_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS weights (
      id SERIAL PRIMARY KEY,
      variable_id TEXT NOT NULL,
      weight_value REAL NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // v0.2 신규 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitors (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      current_elo REAL NOT NULL DEFAULT 1500,
      match_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS elo_history (
      id SERIAL PRIMARY KEY,
      competitor_id INTEGER REFERENCES competitors(id) ON DELETE CASCADE,
      deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
      elo_before REAL NOT NULL,
      elo_after REAL NOT NULL,
      our_outcome INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deal_competitors (
      deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
      competitor_id INTEGER REFERENCES competitors(id) ON DELETE CASCADE,
      PRIMARY KEY (deal_id, competitor_id)
    );

    CREATE TABLE IF NOT EXISTS decision_traces (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      decision TEXT NOT NULL,
      rationale TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ensemble_weights (
      id SERIAL PRIMARY KEY,
      pillar_mult REAL NOT NULL DEFAULT 0.45,
      bayesian REAL NOT NULL DEFAULT 0.30,
      elo REAL NOT NULL DEFAULT 0.20,
      monte_carlo REAL NOT NULL DEFAULT 0.05,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS our_elo (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      elo REAL NOT NULL DEFAULT 1500,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- predictions에 v0.2 컬럼 추가
    ALTER TABLE predictions ADD COLUMN IF NOT EXISTS sub_scores JSONB;
    ALTER TABLE predictions ADD COLUMN IF NOT EXISTS pillar_scores JSONB;
    ALTER TABLE predictions ADD COLUMN IF NOT EXISTS method_probs JSONB;
    ALTER TABLE predictions ADD COLUMN IF NOT EXISTS confidence_low REAL;
    ALTER TABLE predictions ADD COLUMN IF NOT EXISTS confidence_high REAL;
    ALTER TABLE predictions ADD COLUMN IF NOT EXISTS competitor_ids INTEGER[];

    -- deals에 일정/메타 컬럼 추가
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS industry TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS expected_revenue REAL;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';  -- manual | import
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
  `);

  // v0.3 신규 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS label_overrides (
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      field TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (scope, key, field)
    );

    CREATE TABLE IF NOT EXISTS voting_links (
      deal_id INTEGER PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      closes_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS voters (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      weight REAL NOT NULL DEFAULT 1.0,
      client_token TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (deal_id, display_name)
    );

    CREATE TABLE IF NOT EXISTS votes (
      voter_id INTEGER NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
      sub_factor_id TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (voter_id, sub_factor_id)
    );
  `);

  // v0.4 신규 테이블 + 컬럼
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_studies (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
      outcome TEXT NOT NULL,
      tech_capability REAL,
      reference REAL,
      sales REAL,
      price_cost REAL,
      consortium REAL,
      differentiation REAL,
      win_loss_cause TEXT,
      lessons_learned TEXT,
      competitors_named TEXT[],
      consortium_partners JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS external_research (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      source TEXT NOT NULL,
      query TEXT,
      result_text TEXT,
      result_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (deal_id, topic)
    );

    ALTER TABLE deals ADD COLUMN IF NOT EXISTS execution_unit TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS pm TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS duration_months INTEGER;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS vdc_a REAL;
    ALTER TABLE voters ADD COLUMN IF NOT EXISTS role_v1 TEXT;

    -- v0.9: 대시보드 패널 데이터
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS partners JSONB DEFAULT '[]';
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS risks JSONB DEFAULT '[]';
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]';
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS competitive_positioning JSONB DEFAULT '{}';

    -- v1.0: SG 보고서 구조 필드
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS importance_stars INTEGER DEFAULT 3;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS bid_timeline JSONB DEFAULT '{}';
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS team_size INTEGER;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS team_members JSONB DEFAULT '[]';
    ALTER TABLE deal_competitors ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE deal_competitors ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'medium';


    -- v0.5: applied_at — 어드민이 AI 추정값을 정량 모델에 수동 채택한 시점
    ALTER TABLE external_research ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

    -- v0.8: 재무 시뮬레이션 + 전략 경로 지원
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS margin_rate REAL;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS strategic_weight TEXT DEFAULT 'normal';

    CREATE TABLE IF NOT EXISTS action_log (
      id                 SERIAL PRIMARY KEY,
      deal_id            INT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      action_id          TEXT NOT NULL,
      taken_at           TIMESTAMPTZ DEFAULT NOW(),
      taken_by           TEXT,
      notes              TEXT,
      sub_scores_before  JSONB,
      sub_scores_after   JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_action_log_deal ON action_log (deal_id, taken_at DESC);

    CREATE TABLE IF NOT EXISTS deal_scenarios (
      id           SERIAL PRIMARY KEY,
      deal_id      INT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      actions      JSONB NOT NULL DEFAULT '[]',
      prob_path    JSONB NOT NULL DEFAULT '[]',
      revenue_path JSONB NOT NULL DEFAULT '[]',
      created_by   TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_deal_scenarios_deal ON deal_scenarios (deal_id);

    -- v1.1: SG 실물 양식 완성 (KT매출·발표형식·평가기준·VDC-B·조직표·Q&A·Winning)
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS contribution_margin REAL;       -- 공헌이익률(%)
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS subcontract_rate REAL;          -- 하도율(%)
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS risk_grade TEXT;                -- 리스크등급 A/B/C/D
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS pt_format TEXT;                 -- 제안발표회 형식
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS customer_eval_criteria TEXT;    -- 고객 평가기준
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS vdc_b_result JSONB DEFAULT '[]';   -- [{decision, detail}]
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS qna_items JSONB DEFAULT '[]';      -- [{question, answer}]
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS winning_points JSONB DEFAULT '[]'; -- [{customer_cfs, winning_point}]

    -- v1.2: Pillar 사유·대응 수동 편집
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS pillar_rationale JSONB DEFAULT '{}';
  `);

  // 시드 데이터
  const { rows: compCount } = await pool.query('SELECT COUNT(*)::int as c FROM competitors');
  if (compCount[0].c === 0) {
    for (const name of ['LG CNS', 'Samsung SDS', 'SKT', 'POSCO DX', 'LIG Nex1', '내부 (자체개발)']) {
      await pool.query('INSERT INTO competitors (name) VALUES ($1)', [name]);
    }
  }

  const { rows: ourEloRow } = await pool.query('SELECT COUNT(*)::int as c FROM our_elo');
  if (ourEloRow[0].c === 0) {
    await pool.query('INSERT INTO our_elo (id, elo) VALUES (1, 1500)');
  }

  const { rows: ensRow } = await pool.query('SELECT version, pillar_mult FROM ensemble_weights ORDER BY version DESC LIMIT 1');
  if (ensRow.length === 0) {
    // 최초 seed: 재보정된 보수적 가중치
    await pool.query(`INSERT INTO ensemble_weights (pillar_mult, bayesian, elo, monte_carlo, version)
                      VALUES (0.30, 0.40, 0.20, 0.10, 1)`);
  } else if (ensRow[0].pillar_mult === 0.45) {
    // 구버전(0.45) 감지 시 새 버전 삽입 — 과대산정 수정 (pillar 편향 제거)
    const nextVer = (ensRow[0].version ?? 1) + 1;
    await pool.query(`INSERT INTO ensemble_weights (pillar_mult, bayesian, elo, monte_carlo, version)
                      VALUES (0.30, 0.40, 0.20, 0.10, $1)`, [nextVer]);
  }

  // v0.6: question_items 테이블 (Win Possibility Framework 35개 질문)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_items (
      id SERIAL PRIMARY KEY,
      question_no INTEGER NOT NULL,
      sub_factor_id TEXT NOT NULL,
      lv1_category TEXT NOT NULL,
      lv2_group TEXT NOT NULL,
      lv3_label TEXT NOT NULL,
      question_text TEXT NOT NULL,
      importance TEXT NOT NULL DEFAULT 'mid',
      score_low INTEGER NOT NULL DEFAULT 2,
      score_mid INTEGER NOT NULL DEFAULT 6,
      score_high INTEGER NOT NULL DEFAULT 9,
      display_order INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (question_no)
    );
  `);

  // question_items 시드 (35개, idempotent)
  const { rows: qiCount } = await pool.query('SELECT COUNT(*)::int as c FROM question_items');
  if (qiCount[0].c === 0) {
    const questions: [number, string, string, string, string, string, string][] = [
      // [question_no, sub_factor_id, lv1, lv2_group, lv3_label, question_text, importance]
      // S — 사전영업
      [1,  's_key_man_contact', 'S', 'Key Man', 'Key Man 발굴',    'Key Man(핵심 의사결정자)을 식별하고 발굴했는가',           'high'],
      [2,  's_key_man_contact', 'S', 'Key Man', 'Key Man 접촉',    'Key Man과 직접 접촉하고 관계를 형성했는가',               'high'],
      [3,  's_evaluator_rfp',  'S', '평가자·RFP', '평가자 파악',   '평가자·평가위원 구성을 사전에 파악했는가',                'high'],
      [4,  's_evaluator_rfp',  'S', '평가자·RFP', 'RFP 사전 확인', 'RFP 작성에 사전 참여하거나 내용을 사전 확인했는가',       'high'],
      [5,  's_poc_proposal',   'S', 'PoC·제안', 'PoC 기회',       'PoC·파일럿 프로젝트를 통해 역량을 검증받았는가',          'mid'],
      [6,  's_poc_proposal',   'S', 'PoC·제안', '사전 제안 기회', '사전 제안·컨셉 발표 기회를 확보했는가',                   'mid'],
      [7,  's_poc_proposal',   'S', 'PoC·제안', '내부 챔피언',    '고객 내부에서 우리를 지지하는 챔피언을 확보했는가',        'mid'],
      // V — Value Impact
      [8,  'v_needs_painpoint',   'V', '니즈·Pain Point', '니즈 파악',      '고객의 핵심 비즈니스 니즈를 심층 파악했는가',              'high'],
      [9,  'v_needs_painpoint',   'V', '니즈·Pain Point', 'Pain Point 분석', '고객의 Pain Point를 구체적으로 분석했는가',               'high'],
      [10, 'v_value_proposition', 'V', '가치 제안', 'KPI 연계',            '고객 KPI·성과지표에 직접 연계된 가치를 제안했는가',        'high'],
      [11, 'v_value_proposition', 'V', '가치 제안', '비즈니스 임팩트',     '매출 증대·비용 절감 등 임팩트를 정량화했는가',             'high'],
      [12, 'v_presentation',      'V', 'C-Level 발표', '발표 기회',         'C-Level·임원 대상으로 제안 발표 기회를 얻었는가',           'mid'],
      [13, 'v_presentation',      'V', 'C-Level 발표', '임원 인지도',        '고객 경영진이 우리 솔루션 가치를 인지하고 있는가',          'mid'],
      [14, 'v_presentation',      'V', 'C-Level 발표', '내부 지지',          '고객 내부 의사결정 과정에서 우리를 지지하는가',             'mid'],
      // D — 차별화
      [15, 'd_competitive_strategy', 'D', '차별화·Why Us', '차별화 요소',   '경쟁사 대비 명확한 차별화 요소를 갖추고 있는가',           'high'],
      [16, 'd_competitive_strategy', 'D', '차별화·Why Us', 'Why KT 논리',   '"Why Us/Why KT" 논리를 임원이 납득할 수준으로 갖췄는가',  'high'],
      [17, 'd_tech_reference',       'D', '기술·레퍼런스', '기술 우위',      'PoC·특허·AI 역량 등 기술 우위를 보유하고 있는가',          'high'],
      [18, 'd_tech_reference',       'D', '기술·레퍼런스', '유사 레퍼런스',  '동일·유사 영역에서 검증된 레퍼런스를 보유하고 있는가',     'high'],
      [19, 'd_partner',              'D', '파트너·컨소시엄', '파트너 차별성',  '파트너·컨소시엄 구성이 경쟁사 대비 차별성이 있는가',        'mid'],
      [20, 'd_partner',              'D', '파트너·컨소시엄', '전략적 파트너십', '전략적 파트너십이 수주에 유리하게 작용하는가',              'mid'],
      [21, 'd_partner',              'D', '파트너·컨소시엄', '역량 보완성',    '협력사 기술·역량이 우리의 약점을 효과적으로 보완하는가',    'mid'],
      // P — 가격경쟁력
      [22, 'p_budget_fit',       'P', '예산 적합성', '예산 파악',        '고객의 예산 규모를 사전에 파악했는가',                     'high'],
      [23, 'p_budget_fit',       'P', '예산 적합성', '사업 규모 적합성', '우리 제안 규모가 고객 예산과 적합하게 구성됐는가',         'mid'],
      [24, 'p_price_competition', 'P', '가격 우위', '경쟁가 대비 우위',  '경쟁사 대비 가격 경쟁력을 확보하고 있는가',               'high'],
      [25, 'p_price_competition', 'P', '가격 우위', '협력사 단가',       '협력사·원가 경쟁력으로 단가 우위를 확보했는가',            'high'],
      [26, 'p_cost_value',       'P', 'ROI·TCO', 'ROI 정량 제시',      'ROI를 정량적·구체적으로 제시할 수 있는가',                 'high'],
      [27, 'p_cost_value',       'P', 'ROI·TCO', 'TCO 절감 효과',      '총 소유 비용(TCO) 절감 효과를 명확히 제시했는가',          'mid'],
      [28, 'p_cost_value',       'P', 'ROI·TCO', '가성비 논리',        '비용 대비 가치(가성비) 논리를 고객이 납득하는가',           'mid'],
      // E — Delivery
      [29, 'e_track_record',    'E', '수주·이행 실적', '동종 수주 실적',  '동종 사업을 수주한 실적을 보유하고 있는가',                'high'],
      [30, 'e_track_record',    'E', '수주·이행 실적', '이행 레퍼런스',   '관련 산업·고객군에서 성공적으로 이행한 레퍼런스가 있는가', 'high'],
      [31, 'e_risk_management', 'E', '리스크 관리', '리스크 식별',       '사업 수행 리스크를 사전에 구체적으로 식별했는가',          'high'],
      [32, 'e_risk_management', 'E', '리스크 관리', '대응 방안',         '각 리스크에 대한 구체적인 대응 방안을 수립했는가',         'high'],
      [33, 'e_execution_team',  'E', '전담팀·PM', '전담팀 구성',        '전담 수행팀을 구성하고 투입 가능한 상태인가',              'mid'],
      [34, 'e_execution_team',  'E', '전담팀·PM', 'PM 역량',            'PM·PLer의 관련 사업 경험과 역량이 검증됐는가',             'mid'],
      [35, 'e_execution_team',  'E', '전담팀·PM', 'AIDD 생산성',        'AIDD·디지털 도구 기반 생산성 향상 근거를 제시할 수 있는가', 'mid'],
    ];
    for (const [qno, sfid, lv1, lv2, lv3, qtext, imp] of questions) {
      await pool.query(
        `INSERT INTO question_items (question_no, sub_factor_id, lv1_category, lv2_group, lv3_label, question_text, importance, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$1)`,
        [qno, sfid, lv1, lv2, lv3, qtext, imp]
      );
    }
  }

  // v0.6: sub-factor 기본 가중치 (15개 신규 + 5 pillar)
  const { rows: weightCount } = await pool.query(
    `SELECT COUNT(*)::int as c FROM weights WHERE variable_id LIKE 's\\_%' OR variable_id LIKE 'v\\_%' OR variable_id LIKE 'd\\_%' OR variable_id LIKE 'p\\_%' OR variable_id LIKE 'e\\_%' ESCAPE '\\'`
  );
  if (weightCount[0].c === 0) {
    const subDefaults: [string, number][] = [
      // S 사전영업 sub-weights
      ['s_key_man_contact', 0.40], ['s_evaluator_rfp', 0.40], ['s_poc_proposal', 0.20],
      // V Value Impact sub-weights
      ['v_needs_painpoint', 0.40], ['v_value_proposition', 0.40], ['v_presentation', 0.20],
      // D 차별화 sub-weights
      ['d_competitive_strategy', 0.40], ['d_tech_reference', 0.40], ['d_partner', 0.20],
      // P 가격경쟁력 sub-weights
      ['p_budget_fit', 0.30], ['p_price_competition', 0.40], ['p_cost_value', 0.30],
      // E Delivery sub-weights
      ['e_track_record', 0.40], ['e_risk_management', 0.40], ['e_execution_team', 0.20],
      // pillar 가중치 — 5-Pillar 균등
      ['pillar_S', 0.20], ['pillar_V', 0.20], ['pillar_D', 0.20], ['pillar_P', 0.20], ['pillar_E', 0.20],
    ];
    for (const [id, val] of subDefaults) {
      await pool.query(
        'INSERT INTO weights (variable_id, weight_value, version) VALUES ($1, $2, 3)',
        [id, val]
      );
    }
  }

  // v0.7: RAG 인프라 — 사내 문서 임베딩 (pgvector)
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`).catch((e) => {
    console.warn('[pgvector] extension creation failed (may need superuser):', e.message);
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      doc_type TEXT NOT NULL,
      title TEXT NOT NULL,
      source_path TEXT,
      deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
      customer TEXT,
      industry TEXT,
      metadata JSONB,
      raw_text TEXT,
      word_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);
    CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
  `);

  // chunks 테이블 — pgvector 사용 가능 여부에 따라 분기
  const { rows: pgvCheck } = await pool.query(
    `SELECT 1 FROM pg_extension WHERE extname = 'vector' LIMIT 1`
  );
  const hasPgvector = pgvCheck.length > 0;

  if (hasPgvector) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_total INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB,
        word_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (document_id, chunk_index)
      );

      CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_document_chunks_meta_type ON document_chunks ((metadata->>'doc_type'));
      CREATE INDEX IF NOT EXISTS idx_document_chunks_meta_customer ON document_chunks ((metadata->>'customer'));
    `);

    // ivfflat 인덱스 — 데이터가 들어온 후에만 의미가 있어 별도 시도
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
        ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    `).catch(() => { /* 데이터 없으면 skip OK */ });
  } else {
    // pgvector 미설치 시 fallback — embedding을 JSONB로 저장 (개발용)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_total INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding JSONB,
        metadata JSONB,
        word_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (document_id, chunk_index)
      );
      CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(document_id);
    `);
  }

  // v0.8: DART 공시 인프라
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dart_corp_map (
      id SERIAL PRIMARY KEY,
      corp_code TEXT UNIQUE NOT NULL,
      corp_name TEXT NOT NULL,
      aliases JSONB DEFAULT '[]'::jsonb,
      is_listed BOOLEAN DEFAULT TRUE,
      industry TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_dart_corp_map_name ON dart_corp_map (corp_name);

    CREATE TABLE IF NOT EXISTS dart_filings (
      id SERIAL PRIMARY KEY,
      corp_code TEXT NOT NULL,
      corp_name TEXT NOT NULL,
      rcept_no TEXT UNIQUE NOT NULL,
      report_nm TEXT,
      flr_nm TEXT,
      rcept_dt DATE,
      summary TEXT,
      raw_json JSONB,
      relevance_score INTEGER DEFAULT 0,
      tags JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_dart_filings_corp ON dart_filings (corp_code, rcept_dt DESC);
    CREATE INDEX IF NOT EXISTS idx_dart_filings_relevance ON dart_filings (relevance_score DESC);
  `);

  // v1.4: 지정학 분석 인프라
  await pool.query(`
    CREATE TABLE IF NOT EXISTS geo_sessions (
      id SERIAL PRIMARY KEY,
      topic TEXT NOT NULL,
      analysis_text TEXT,
      driver_scores JSONB,
      geo_prob INTEGER,
      token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS geo_signal_cards (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES geo_sessions(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      description TEXT,
      driver_deltas JSONB,
      direction TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS geo_votes (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES geo_sessions(id),
      card_id INTEGER REFERENCES geo_signal_cards(id),
      voted_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_geo_votes_session ON geo_votes(session_id);
    CREATE INDEX IF NOT EXISTS idx_geo_cards_session ON geo_signal_cards(session_id);

    -- v1.5: 지정학 투표에 역할 가중치 — 참여자 이름/역할 기록
    ALTER TABLE geo_votes ADD COLUMN IF NOT EXISTS voter_name TEXT;
    ALTER TABLE geo_votes ADD COLUMN IF NOT EXISTS voter_role TEXT;

    -- v1.6: 지정학 파이프라인에 가설 + 조건부 전략 추가
    ALTER TABLE geo_sessions ADD COLUMN IF NOT EXISTS hypothesis TEXT;
    ALTER TABLE geo_sessions ADD COLUMN IF NOT EXISTS strategy_low TEXT;
    ALTER TABLE geo_sessions ADD COLUMN IF NOT EXISTS strategy_mid TEXT;
    ALTER TABLE geo_sessions ADD COLUMN IF NOT EXISTS strategy_high TEXT;

    -- v1.7: 폴리마켓 시장 데이터 (수동 인입)
    CREATE TABLE IF NOT EXISTS polymarket_markets (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      category TEXT NOT NULL,   -- 지정학 | AI | 글로벌경제
      question TEXT,
      yes_price_pct INTEGER,    -- 0~100
      end_date DATE,
      our_prob BOOLEAN NOT NULL DEFAULT FALSE,  -- 우리 geoProb와 비교 대상 여부
      volume_usd BIGINT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );


    -- v1.8: 가설 방법론 — Fact/Evidence/Bayesian/JudgmentDB
    ALTER TABLE geo_sessions ADD COLUMN IF NOT EXISTS prior_prob INTEGER;
    ALTER TABLE geo_sessions ADD COLUMN IF NOT EXISTS facts JSONB;
    ALTER TABLE geo_sessions ADD COLUMN IF NOT EXISTS actual_outcome TEXT;
    ALTER TABLE geo_sessions ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    ALTER TABLE geo_signal_cards ADD COLUMN IF NOT EXISTS evidence TEXT;

    -- v1.9: 데모 참가자 명단 (이름 자동완성 + 역할 자동 채움)
    CREATE TABLE IF NOT EXISTS demo_participants (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      voter_role TEXT NOT NULL
    );
  `);

  // v1.8: Judgment DB 데모 시드 (과거 예측 3개)
  const { rows: jdCount } = await pool.query(
    `SELECT COUNT(*)::int as c FROM geo_sessions WHERE token LIKE 'demo_seed_%'`
  );
  if (jdCount[0].c === 0) {
    type JudgmentRow = [string, string, number, number, string, string, string];
    const judgeSeeds: JudgmentRow[] = [
      ['이란-이스라엘 휴전 협상 (2026.04)', 'demo_seed_001', 28, 31, 'ceasefire_extended', '2026-04-21', '오만 중재로 90일 휴전 합의 → 예측 방향 일치'],
      ['호르무즈 해협 봉쇄 리스크 (2026.01)', 'demo_seed_002', 41, 38, 'no_blockade', '2026-01-31', '이란 봉쇄 미실시 → 낮은 확률 예측 일치'],
      ['우크라이나 휴전 협상 (2025.12)', 'demo_seed_003', 58, 61, 'talks_failed', '2025-12-31', '협상 결렬 → 높은 확률 예측이 오판'],
    ];
    for (const [topic, token, priorProb, geoProb, outcome, resolvedAt, note] of judgeSeeds) {
      await pool.query(
        `INSERT INTO geo_sessions (topic, token, prior_prob, geo_prob, actual_outcome, resolved_at, analysis_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (token) DO NOTHING`,
        [topic, token, priorProb, geoProb, outcome, resolvedAt, note]
      );
    }
  }


  // v1.9: 데모 참가자 시드 (idempotent)
  const { rows: dpCount } = await pool.query(
    `SELECT COUNT(*)::int as c FROM demo_participants`
  );
  if (dpCount[0].c === 0) {
    type ParticipantRow = [string, string];
    const participants: ParticipantRow[] = [
      ['전현호', 'pmo'],
      ['홍해천', 'executive'],
      ['정용섭', 'executive'],
      ['안지운', 'pmo'],
      ['박희철', 'reviewer'],
      ['김대희', 'reviewer'],
      ['김종혁', 'executive'],
      ['김도완', 'reviewer'],
      ['정운석', 'reviewer'],
      ['허윤범', 'reviewer'],
      ['조광배', 'reviewer'],
    ];
    for (const [name, role] of participants) {
      await pool.query(
        `INSERT INTO demo_participants (name, voter_role) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [name, role]
      );
    }
  }

  // v1.7: 폴리마켓 시장 데이터 시드 (idempotent)
  const { rows: pmCount } = await pool.query('SELECT COUNT(*)::int as c FROM polymarket_markets');
  if (pmCount[0].c === 0) {
    const IRAN_Q = '미국, 새로운 이란 협정/휴전 연장 발표...?';
    const iranMarkets: [string, string, string, number, string, boolean, number][] = [
      // [label, category, question, yes_price_pct, end_date, our_prob, volume_usd]
      ['미-이란 휴전 연장 (6/7)',  '지정학', IRAN_Q,  1, '2026-06-07', true,  2813240],
      ['미-이란 휴전 연장 (6/9)',  '지정학', IRAN_Q,  4, '2026-06-09', true,   360871],
      ['미-이란 휴전 연장 (6/12)', '지정학', IRAN_Q, 10, '2026-06-12', true,   194431],
      ['미-이란 휴전 연장 (6/15)', '지정학', IRAN_Q, 14, '2026-06-15', true,   145105],
      ['미-이란 휴전 연장 (6/30)', '지정학', IRAN_Q, 38, '2026-06-30', true,  1235300],
      ['미-이란 휴전 연장 (7/31)', '지정학', IRAN_Q, 59, '2026-07-31', true,    96967],
    ];
    for (const [label, category, question, yesPrice, endDate, ourProb, volume] of iranMarkets) {
      await pool.query(
        `INSERT INTO polymarket_markets (label, category, question, yes_price_pct, end_date, our_prob, volume_usd)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [label, category, question, yesPrice, endDate, ourProb, volume]
      );
    }
  }

  // v0.4: 2025 Q4 PDF 시드 (idempotent)
  try {
    const { seedFromBundledData } = await import('./seed');
    const result = await seedFromBundledData(pool);
    if (!result.skipped) {
      console.log('[seed_2025Q4]', result);
    }
  } catch (e) {
    console.error('[seed_2025Q4] failed:', e);
  }

  // v0.7: 사내 수주전략 문서 시드 (markdown → documents 테이블)
  try {
    const { seedStrategyDocs } = await import('./seedStrategyDocs');
    const r = await seedStrategyDocs(pool);
    if (r.inserted > 0) console.log('[seed_strategy_docs]', r);
  } catch (e) {
    console.error('[seed_strategy_docs] failed:', e);
  }
}

export async function getDb(): Promise<Pool> {
  if (!initialized) {
    if (!initPromise) {
      initPromise = runInit().then(() => { initialized = true; });
    }
    await initPromise;
  }
  return pool;
}
