// 2025 Q4 PDF 데이터 시드 — runInit() 마지막에 호출. idempotent.
import { Pool } from 'pg';
import { SUB_FACTORS } from './pillars';
import { updateAllCompetitorElos, INITIAL_ELO } from './elo';
import * as fs from 'fs';
import * as path from 'path';

interface SeedDeal {
  client_name: string;
  industry: string;
  execution_unit: string;
  pm: string;
  deal_size_eok: number;
  duration_months: number | null;
  vdc_a: number | null;
  announced_at: string | null;
  risk: number;
  result: 'win' | 'loss' | 'sue' | 'drop' | 'delay' | 'unknown';
  profit_rate: number | null;
}

interface SeedCompetitor {
  name: string;
  estimated_elo: number;
  strength_area: string;
}

interface SeedCaseStudy {
  client_name: string;
  industry: string;
  outcome: 'win' | 'loss';
  risk_level: number;
  deal_size_eok: number;
  total_size_eok?: number;
  duration_months: number;
  scores: {
    tech_capability: number;
    reference: number;
    sales: number;
    price_cost: number;
    consortium: number;
    differentiation: number;
  };
  win_loss_cause: string;
  lessons_learned: string;
  competitors_named: string[];
  consortium_partners: { name: string; share: number; role: string }[];
  profit_rate: number;
  announced_at: string;
}

// Risk 1~5 → sub-factor score (Risk 1=9, Risk 5=3)
function riskToScore(risk: number): number {
  const r = Math.max(1, Math.min(5, Math.round(risk)));
  return Math.max(3, Math.round(10 - (r - 1) * 1.75));
}

function buildSubScores(risk: number): Record<string, number> {
  const score = riskToScore(risk);
  return Object.fromEntries(SUB_FACTORS.map(f => [f.id, score]));
}

// Risk → prior 확률 (industry prior 없을 때 fallback)
function riskToProbability(risk: number): number {
  const map: Record<number, number> = { 1: 0.95, 2: 0.60, 3: 0.35, 4: 0.10, 5: 0.05 };
  return map[Math.max(1, Math.min(5, Math.round(risk)))] ?? 0.35;
}

function loadJson<T>(filename: string): T {
  const candidates = [
    path.join(process.cwd(), 'data', 'seed', filename),
    path.join(process.cwd(), 'dashboard', 'data', 'seed', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
    }
  }
  throw new Error(`Seed file not found: ${filename}`);
}

export async function seedFromBundledData(pool: Pool): Promise<{
  skipped?: boolean;
  insertedDeals?: number;
  insertedCases?: number;
}> {
  // idempotent: source='seed_2025Q4' row 존재 시 skip
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as c FROM deals WHERE source='seed_2025Q4'`
  );
  if (rows[0].c > 0) return { skipped: true };

  let deals: SeedDeal[];
  let competitors: SeedCompetitor[];
  let caseStudies: SeedCaseStudy[];

  try {
    deals = loadJson<SeedDeal[]>('deals-2025Q4.json');
    competitors = loadJson<SeedCompetitor[]>('competitors.json');
    caseStudies = loadJson<SeedCaseStudy[]>('case-studies-2025Q4.json');
  } catch (e) {
    console.error('[seed] JSON load failed:', e);
    return { skipped: true };
  }

  // 1) competitors 시드 (이미 있으면 elo 업데이트)
  for (const c of competitors) {
    await pool.query(
      `INSERT INTO competitors (name, current_elo)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET current_elo = EXCLUDED.current_elo
       WHERE competitors.match_count = 0`,
      [c.name, c.estimated_elo]
    );
  }

  // 2) deals + predictions + outcomes 시드
  let insertedDeals = 0;
  const dealIdByClient: Record<string, number> = {};
  for (const d of deals) {
    if (d.result === 'drop' || d.result === 'unknown' || d.result === 'delay') continue;
    if (!d.announced_at) continue;

    const actual = d.result === 'win' || d.result === 'sue' ? 1 : 0;
    const subScores = buildSubScores(d.risk);
    const prob = riskToProbability(d.risk);

    const { rows: dealRow } = await pool.query(
      `INSERT INTO deals (client_name, source, industry, execution_unit, pm,
                          deal_size, duration_months, vdc_a, created_at)
       VALUES ($1, 'seed_2025Q4', $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        d.client_name, d.industry, d.execution_unit, d.pm,
        String(Math.round(d.deal_size_eok * 100000000)),
        d.duration_months, d.vdc_a, d.announced_at,
      ]
    );
    const dealId = dealRow[0].id;
    dealIdByClient[d.client_name] = dealId;

    await pool.query(
      `INSERT INTO predictions
         (deal_id, variables_json, predicted_probability, weights_used_json, sub_scores, created_at)
       VALUES ($1, $2, $3, '{}', $4, $5)`,
      [dealId, JSON.stringify({ risk: d.risk }), prob * 100, JSON.stringify(subScores), d.announced_at]
    );
    await pool.query(
      `INSERT INTO outcomes (deal_id, actual_result, closed_at) VALUES ($1, $2, $3)`,
      [dealId, actual, d.announced_at]
    );
    insertedDeals++;
  }

  // 3) case_studies 시드 + 경쟁사 Elo 업데이트
  let insertedCases = 0;
  for (const cs of caseStudies) {
    const dealId = dealIdByClient[cs.client_name];
    if (!dealId) continue;

    await pool.query(
      `INSERT INTO case_studies (deal_id, outcome, tech_capability, reference, sales,
                                  price_cost, consortium, differentiation,
                                  win_loss_cause, lessons_learned,
                                  competitors_named, consortium_partners)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        dealId, cs.outcome,
        cs.scores.tech_capability, cs.scores.reference, cs.scores.sales,
        cs.scores.price_cost, cs.scores.consortium, cs.scores.differentiation,
        cs.win_loss_cause, cs.lessons_learned,
        cs.competitors_named, JSON.stringify(cs.consortium_partners),
      ]
    );
    insertedCases++;

    // 매치업 → Elo 업데이트
    const { rows: compRows } = await pool.query(
      `SELECT id, current_elo FROM competitors WHERE name = ANY($1)`,
      [cs.competitors_named]
    );
    if (compRows.length === 0) continue;

    const { rows: ourRow } = await pool.query('SELECT elo FROM our_elo WHERE id=1');
    const ourElo = ourRow[0]?.elo ?? INITIAL_ELO;
    const ourScore: 0 | 1 = cs.outcome === 'win' ? 1 : 0;

    const result = updateAllCompetitorElos(
      ourElo,
      compRows.map(r => ({ id: r.id, elo: r.current_elo })),
      ourScore
    );

    for (const u of result.updated) {
      await pool.query(
        `UPDATE competitors SET current_elo=$1, match_count = match_count + 1 WHERE id=$2`,
        [u.eloAfter, u.id]
      );
      await pool.query(
        `INSERT INTO elo_history (competitor_id, deal_id, elo_before, elo_after, our_outcome)
         VALUES ($1, $2, $3, $4, $5)`,
        [u.id, dealId, u.eloBefore, u.eloAfter, ourScore]
      );
      await pool.query(
        `INSERT INTO deal_competitors (deal_id, competitor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [dealId, u.id]
      );
    }
    await pool.query(`UPDATE our_elo SET elo=$1, updated_at=NOW() WHERE id=1`, [result.ourNewElo]);
  }

  // 4) industry prior 재계산 → label_overrides scope='prior'
  await recalcIndustryPrior(pool);

  return { insertedDeals, insertedCases };
}

export async function recalcIndustryPrior(pool: Pool): Promise<void> {
  const { rows: byIndustry } = await pool.query(`
    SELECT d.industry,
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE o.actual_result = 1)::int as wins
    FROM deals d JOIN outcomes o ON o.deal_id = d.id
    WHERE d.industry IS NOT NULL
    GROUP BY d.industry
  `);

  for (const r of byIndustry) {
    // Laplace smoothing
    const smoothed = (r.wins + 1) / (r.total + 2);
    await pool.query(
      `INSERT INTO label_overrides (scope, key, field, value, updated_at)
       VALUES ('prior', $1, 'win_rate', $2, NOW())
       ON CONFLICT (scope, key, field) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [r.industry, String(smoothed)]
    );
  }

  // 전체 prior
  const { rows: totalRow } = await pool.query(`
    SELECT COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE o.actual_result = 1)::int as wins
    FROM deals d JOIN outcomes o ON o.deal_id = d.id
  `);
  if (totalRow[0].total > 0) {
    const smoothed = (totalRow[0].wins + 1) / (totalRow[0].total + 2);
    await pool.query(
      `INSERT INTO label_overrides (scope, key, field, value, updated_at)
       VALUES ('prior', '_global', 'win_rate', $1, NOW())
       ON CONFLICT (scope, key, field) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [String(smoothed)]
    );
  }

  // Risk별 prior
  const { rows: byRisk } = await pool.query(`
    SELECT (p.variables_json->>'risk')::int as risk,
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE o.actual_result = 1)::int as wins
    FROM deals d
    JOIN predictions p ON p.deal_id = d.id
    JOIN outcomes o ON o.deal_id = d.id
    WHERE p.variables_json->>'risk' IS NOT NULL
    GROUP BY (p.variables_json->>'risk')::int
  `);
  for (const r of byRisk) {
    const smoothed = (r.wins + 1) / (r.total + 2);
    await pool.query(
      `INSERT INTO label_overrides (scope, key, field, value, updated_at)
       VALUES ('prior', $1, 'win_rate', $2, NOW())
       ON CONFLICT (scope, key, field) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [`risk_${r.risk}`, String(smoothed)]
    );
  }
}
