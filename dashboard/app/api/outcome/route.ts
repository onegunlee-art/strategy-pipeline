// 딜 결과 기록 + Elo 자동 업데이트
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { updateAllCompetitorElos } from '@/lib/elo';

export async function POST(req: NextRequest) {
  try {
    const { deal_id, actual_result } = await req.json() as {
      deal_id: number;
      actual_result: 0 | 1;
    };

    const db = await getDb();

    // 1) outcome 저장
    await db.query('INSERT INTO outcomes (deal_id, actual_result) VALUES ($1, $2)', [
      deal_id, actual_result,
    ]);

    // 2) 해당 딜의 경쟁사 Elo 업데이트
    const { rows: compRows } = await db.query(
      `SELECT c.id, c.current_elo FROM deal_competitors dc
       JOIN competitors c ON c.id = dc.competitor_id
       WHERE dc.deal_id = $1`,
      [deal_id]
    );

    if (compRows.length > 0) {
      const { rows: ourEloRow } = await db.query('SELECT elo FROM our_elo WHERE id=1');
      const ourElo = ourEloRow[0]?.elo ?? 1500;

      const comps = compRows.map((r: { id: number; current_elo: number }) => ({
        id: r.id, elo: r.current_elo,
      }));
      const result = updateAllCompetitorElos(ourElo, comps, actual_result);

      await db.query('UPDATE our_elo SET elo=$1, updated_at=NOW() WHERE id=1', [result.ourNewElo]);

      for (const u of result.updated) {
        await db.query(
          'UPDATE competitors SET current_elo=$1, match_count=match_count+1 WHERE id=$2',
          [u.eloAfter, u.id]
        );
        await db.query(
          `INSERT INTO elo_history (competitor_id, deal_id, elo_before, elo_after, our_outcome)
           VALUES ($1, $2, $3, $4, $5)`,
          [u.id, deal_id, u.eloBefore, u.eloAfter, actual_result]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
