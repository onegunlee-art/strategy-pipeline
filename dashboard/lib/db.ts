import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let initialized = false;
let initPromise: Promise<void> | null = null;

async function runInit() {
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

  const { rows } = await pool.query('SELECT COUNT(*) as c FROM weights');
  if (parseInt(rows[0].c) === 0) {
    for (const [id, value] of [
      ['decision_maker_access', 0.22],
      ['past_win_history', 0.15],
      ['price_competitiveness', 0.18],
      ['tech_differentiation', 0.13],
      ['lg_cns_threat', 0.14],
      ['samsung_sds_threat', 0.10],
      ['budget_confirmed', 0.08],
    ]) {
      await pool.query(
        'INSERT INTO weights (variable_id, weight_value, version) VALUES ($1, $2, 1)',
        [id, value]
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
