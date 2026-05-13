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
