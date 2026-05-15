// Portfolio API — 모든 active deal EV 정렬 + Recommendation
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { deriveRecommendations } from '@/lib/portfolio';

export async function GET() {
  try {
    const db = await getDb();
    // active = outcome 없음 (예측만 있는 진행 중 딜)
    const { rows } = await db.query(`
      SELECT
        d.id, d.client_name, d.industry, d.deal_size, d.source,
        p.predicted_probability,
        p.variables_json,
        COALESCE(o.actual_result, NULL) as actual_result,
        (SELECT COUNT(DISTINCT vt.id)::int FROM voters vt WHERE vt.deal_id = d.id) as voter_count
      FROM deals d
      LEFT JOIN LATERAL (
        SELECT * FROM predictions p2 WHERE p2.deal_id = d.id ORDER BY p2.created_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN outcomes o ON o.deal_id = d.id
      WHERE o.id IS NULL
      ORDER BY d.created_at DESC
      LIMIT 200
    `);

    const items = await Promise.all(rows.map(async (r) => {
      // deal_size를 억으로 추정 (저장 형식: 숫자 문자열 = 원, 또는 "X억" 문자열)
      let dealSizeEok = 0;
      if (typeof r.deal_size === 'string') {
        const m1 = r.deal_size.match(/^(\d+(?:\.\d+)?)\s*억/);
        if (m1) {
          dealSizeEok = Number(m1[1]);
        } else {
          const num = Number(r.deal_size);
          if (!isNaN(num) && num > 0) {
            dealSizeEok = num >= 1e8 ? num / 1e8 : num;
          }
        }
      }

      const winProb = Number(r.predicted_probability ?? 0);
      const evEok = (winProb / 100) * dealSizeEok;

      // average_spread: voting이 있으면 vote_tally에서, 없으면 0
      let avgSpread = 0;
      if (r.voter_count > 0) {
        const { rows: vs } = await db.query(
          `SELECT STDDEV_SAMP(score) as s FROM votes v
           JOIN voters vt ON vt.id = v.voter_id WHERE vt.deal_id = $1`,
          [r.id]
        );
        avgSpread = Number(vs[0]?.s ?? 0);
      }

      const variables = r.variables_json
        ? (typeof r.variables_json === 'string' ? JSON.parse(r.variables_json) : r.variables_json)
        : null;
      const risk = variables?.risk ?? null;

      return {
        id: r.id,
        client_name: r.client_name,
        industry: r.industry,
        deal_size_eok: dealSizeEok,
        win_probability: winProb,
        ev_eok: evEok,
        risk,
        average_spread: avgSpread,
        voter_count: r.voter_count ?? 0,
        source: r.source ?? 'manual',
      };
    }));

    const withRec = deriveRecommendations(items);
    withRec.sort((a, b) => b.ev_eok - a.ev_eok);

    return NextResponse.json({ ok: true, deals: withRec });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
