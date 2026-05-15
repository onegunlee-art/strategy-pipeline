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

    -- v0.5: applied_at — 어드민이 AI 추정값을 정량 모델에 수동 채택한 시점
    ALTER TABLE external_research ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
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

  const { rows: ensRow } = await pool.query('SELECT COUNT(*)::int as c FROM ensemble_weights');
  if (ensRow[0].c === 0) {
    await pool.query(`INSERT INTO ensemble_weights (pillar_mult, bayesian, elo, monte_carlo, version)
                      VALUES (0.45, 0.30, 0.20, 0.05, 1)`);
  }

  // v0.2 sub-factor 기본 가중치 (12개)
  const { rows: weightCount } = await pool.query(
    `SELECT COUNT(*)::int as c FROM weights WHERE variable_id LIKE 'v\\_%' OR variable_id LIKE 'p\\_%' OR variable_id LIKE 'd\\_%' OR variable_id LIKE 'e\\_%' ESCAPE '\\'`
  );
  if (weightCount[0].c === 0) {
    const subDefaults: [string, number][] = [
      ['v_customer_kpi', 0.40], ['v_problem_fit', 0.30], ['v_dm_empathy', 0.30],
      ['p_tco_advantage', 0.40], ['p_roi_clarity', 0.30], ['p_partner_cost', 0.30],
      ['d_why_us', 0.40], ['d_tech_edge', 0.30], ['d_references', 0.30],
      ['e_similar_cases', 0.40], ['e_risk_response', 0.30], ['e_aidd_productivity', 0.30],
      // pillar 가중치 (V=가치영향 최우선, E=실행력, D=차별화, P=가격)
      ['pillar_V', 0.35], ['pillar_P', 0.15], ['pillar_D', 0.20], ['pillar_E', 0.30],
    ];
    for (const [id, val] of subDefaults) {
      await pool.query(
        'INSERT INTO weights (variable_id, weight_value, version) VALUES ($1, $2, 2)',
        [id, val]
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
