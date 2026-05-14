// CSV/JSON 과거 데이터 임포트
// 간략 데이터(예: client_name, deal_size, V/P/D/E 점수, competitors, win/loss)만 있어도 동작
// 임포트 후 자동 시드: base rate prior + Elo 시뮬레이션 + ensemble weight 학습

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { SubScores, PillarId, defaultSubScores, subFactorsOf } from '@/lib/pillars';
import { simulateEloFromHistory, INITIAL_ELO } from '@/lib/elo';

interface ImportRecord {
  client_name: string;
  deal_size?: string;
  industry?: string;
  expected_revenue?: number;
  closed_at?: string;          // ISO date
  actual_result: 0 | 1;        // 1: 수주, 0: 실패
  competitors?: string[];       // 경쟁사 이름 배열
  // 4-pillar 레벨 점수 (sub-factor 미상 시)
  V?: number; P?: number; D?: number; E?: number;
  // sub-factor 직접 (있는 만큼만)
  sub_scores?: Partial<SubScores>;
}

interface ImportBody {
  records: ImportRecord[];
}

// 4-pillar 레벨 점수만 있는 경우 각 sub-factor에 균등 분배
function expandPillarToSubs(rec: ImportRecord): SubScores {
  const subs = defaultSubScores();
  if (rec.sub_scores) {
    Object.assign(subs, rec.sub_scores);
  }
  for (const p of ['V', 'P', 'D', 'E'] as PillarId[]) {
    const pVal = rec[p];
    if (pVal == null) continue;
    // 해당 pillar의 sub_score가 명시 안 된 항목에만 pillar 값 채움
    for (const f of subFactorsOf(p)) {
      if (rec.sub_scores?.[f.id] == null) {
        subs[f.id] = pVal;
      }
    }
  }
  return subs;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ImportBody;
    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      return NextResponse.json({ ok: false, message: 'records 배열이 필요합니다.' }, { status: 400 });
    }

    const db = await getDb();

    // 1) 경쟁사 dedupe & ensure exists
    const allCompetitorNames = new Set<string>();
    for (const r of body.records) {
      r.competitors?.forEach(c => allCompetitorNames.add(c.trim()));
    }
    for (const name of allCompetitorNames) {
      if (name) {
        await db.query(
          'INSERT INTO competitors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
          [name]
        );
      }
    }
    const { rows: compNameRows } = await db.query('SELECT id, name FROM competitors');
    const compIdByName = new Map<string, number>(compNameRows.map((r: { id: number; name: string }) => [r.name, r.id]));

    // 2) records 시간순 정렬 (Elo 시뮬레이션용)
    const sorted = [...body.records].sort((a, b) =>
      (a.closed_at ?? '0').localeCompare(b.closed_at ?? '0')
    );

    // 3) 각 record를 deal/prediction/outcome으로 저장
    let inserted = 0;
    const eloHistory: { competitorIds: number[]; ourScore: 0 | 1 }[] = [];
    const competitorIdSet = new Set<number>();

    for (const rec of sorted) {
      const subs = expandPillarToSubs(rec);
      const competitorIds = (rec.competitors ?? [])
        .map(n => compIdByName.get(n.trim()))
        .filter((x): x is number => x != null);
      competitorIds.forEach(id => competitorIdSet.add(id));

      // deal 삽입
      const { rows: dealRows } = await db.query(
        `INSERT INTO deals (client_name, deal_size, industry, expected_revenue, source, created_at)
         VALUES ($1, $2, $3, $4, 'import', COALESCE($5::timestamptz, NOW()))
         RETURNING id`,
        [
          rec.client_name,
          rec.deal_size ?? null,
          rec.industry ?? null,
          rec.expected_revenue ?? null,
          rec.closed_at ?? null,
        ]
      );
      const dealId = dealRows[0].id;

      // deal_competitors
      for (const cid of competitorIds) {
        await db.query(
          'INSERT INTO deal_competitors (deal_id, competitor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [dealId, cid]
        );
      }

      // prediction (임포트는 predicted_probability를 미지로 처리, NULL 대신 -1 sentinel)
      await db.query(
        `INSERT INTO predictions
          (deal_id, variables_json, predicted_probability, weights_used_json,
           sub_scores, pillar_scores, competitor_ids)
         VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
        [
          dealId,
          JSON.stringify(subs),
          -1,  // 임포트 데이터는 예측 없음
          JSON.stringify({ imported: true }),
          JSON.stringify(subs),
          competitorIds,
        ]
      );

      // outcome
      await db.query(
        `INSERT INTO outcomes (deal_id, actual_result, closed_at)
         VALUES ($1, $2, COALESCE($3::timestamptz, NOW()))`,
        [dealId, rec.actual_result, rec.closed_at ?? null]
      );

      // Elo 시뮬레이션 입력
      if (competitorIds.length > 0) {
        eloHistory.push({ competitorIds, ourScore: rec.actual_result });
      }
      inserted++;
    }

    // 4) Elo 재시뮬레이션 → 모든 경쟁사 + 우리 Elo 업데이트
    const { rows: ourEloRow } = await db.query('SELECT elo FROM our_elo WHERE id=1');
    const ourStartElo = ourEloRow[0]?.elo ?? INITIAL_ELO;
    const sim = simulateEloFromHistory(eloHistory, Array.from(competitorIdSet), ourStartElo);

    await db.query(`UPDATE our_elo SET elo=$1, updated_at=NOW() WHERE id=1`, [sim.ourElo]);
    for (const [cid, elo] of sim.competitorElos) {
      await db.query(
        `UPDATE competitors SET current_elo=$1, match_count=match_count+
           (SELECT COUNT(*)::int FROM deal_competitors WHERE competitor_id=$2)
         WHERE id=$2`,
        [elo, cid]
      );
    }

    // 5) base rate 보고용 계산
    const wins = sorted.filter(r => r.actual_result === 1).length;
    const baseRate = inserted > 0 ? wins / inserted : 0;

    return NextResponse.json({
      ok: true,
      inserted,
      base_rate: Math.round(baseRate * 1000) / 10,
      competitors_seeded: competitorIdSet.size,
      our_elo: Math.round(sim.ourElo),
      message: `${inserted}건 임포트 완료. 경쟁사 Elo + base rate(${(baseRate * 100).toFixed(1)}%) 시드.`,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
