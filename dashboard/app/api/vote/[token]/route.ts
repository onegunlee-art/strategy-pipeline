import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getLabels } from '@/lib/labels';
import { randomBytes } from 'crypto';

function generateClientToken(): string {
  return randomBytes(16).toString('hex');
}

interface QuestionItem {
  id: number;
  question_no: number;
  sub_factor_id: string;
  lv1_category: string;
  lv2_group: string;
  lv3_label: string;
  question_text: string;
  importance: string;
  score_low: number;
  score_mid: number;
  score_high: number;
  display_order: number;
}

// 중요도 가중치
const IMPORTANCE_WEIGHT: Record<string, number> = { high: 3, mid: 2, low: 1 };

// 질문별 선택(low/mid/high) → sub_factor 점수 계산
function computeSubScoresFromQuestions(
  questionItems: QuestionItem[],
  questionAnswers: Record<number, 'low' | 'mid' | 'high'>
): Record<string, number> {
  const acc: Record<string, { wsum: number; wTotal: number }> = {};
  for (const q of questionItems) {
    const ans = questionAnswers[q.question_no];
    if (!ans) continue;
    const rawScore = ans === 'low' ? q.score_low : ans === 'mid' ? q.score_mid : q.score_high;
    const w = IMPORTANCE_WEIGHT[q.importance] ?? 2;
    const a = acc[q.sub_factor_id] ?? (acc[q.sub_factor_id] = { wsum: 0, wTotal: 0 });
    a.wsum += rawScore * w;
    a.wTotal += w;
  }
  const out: Record<string, number> = {};
  for (const [sfid, { wsum, wTotal }] of Object.entries(acc)) {
    out[sfid] = wTotal > 0 ? Math.round((wsum / wTotal) * 10) / 10 : 5;
  }
  return out;
}

// GET /api/vote/[token] — 딜 정보 + 레이블 + 질문 목록 + 내 이전 표
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = await getDb();
  const { rows: linkRows } = await db.query(
    `SELECT vl.*, d.client_name, d.deal_size, d.due_date
     FROM voting_links vl JOIN deals d ON d.id = vl.deal_id
     WHERE vl.token = $1`,
    [params.token]
  );
  if (linkRows.length === 0) {
    return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 });
  }
  const link = linkRows[0];

  const isClosed = link.closes_at && new Date(link.closes_at) < new Date();

  // 내 이전 표 (client_token 쿠키 기반)
  const clientToken = req.cookies.get('wr_voter')?.value;
  const myVotes: Record<string, number> = {};
  let myVoter: { id: number; display_name: string; role: string; weight: number } | null = null;

  if (clientToken) {
    const { rows: voterRows } = await db.query(
      `SELECT vt.*, array_agg(json_build_object('sub_factor_id', v.sub_factor_id, 'score', v.score)) as votes_raw
       FROM voters vt
       LEFT JOIN votes v ON v.voter_id = vt.id
       WHERE vt.deal_id = $1 AND vt.client_token = $2
       GROUP BY vt.id`,
      [link.deal_id, clientToken]
    );
    if (voterRows.length > 0) {
      myVoter = {
        id: voterRows[0].id,
        display_name: voterRows[0].display_name,
        role: voterRows[0].role_v1 ?? voterRows[0].role,
        weight: voterRows[0].weight,
      };
      for (const vr of voterRows[0].votes_raw ?? []) {
        if (vr?.sub_factor_id) myVotes[vr.sub_factor_id] = vr.score;
      }
    }
  }

  // 현재 집계 (참여자 수)
  const { rows: countRows } = await db.query(
    'SELECT COUNT(DISTINCT id)::int as voter_count FROM voters WHERE deal_id = $1',
    [link.deal_id]
  );

  // 질문 목록 (active=true, display_order 순)
  const { rows: questionRows } = await db.query(
    `SELECT * FROM question_items WHERE active=true ORDER BY display_order`
  );

  const labels = await getLabels();

  return NextResponse.json({
    deal_id: link.deal_id,
    client_name: link.client_name,
    deal_size: link.deal_size,
    closes_at: link.closes_at,
    is_closed: isClosed,
    labels: labels.subFactors,
    pillar_labels: labels.pillars,
    questions: questionRows,
    my_voter: myVoter,
    my_votes: myVotes,
    voter_count: countRows[0].voter_count,
  });
}

// POST /api/vote/[token] — 투표 제출 (upsert)
// Body: { display_name, role, question_answers: Record<number, 'low'|'mid'|'high'> }
//   or legacy: { display_name, role, scores: Record<sub_factor_id, number> }
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = await getDb();

  const { rows: linkRows } = await db.query(
    'SELECT * FROM voting_links WHERE token = $1',
    [params.token]
  );
  if (linkRows.length === 0) {
    return NextResponse.json({ error: '유효하지 않은 링크' }, { status: 404 });
  }
  const link = linkRows[0];
  if (link.closes_at && new Date(link.closes_at) < new Date()) {
    return NextResponse.json({ error: '마감된 투표입니다.' }, { status: 410 });
  }

  const body = await req.json();
  const { display_name, role, question_answers, scores: legacyScores } = body;

  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'display_name 필수' }, { status: 400 });
  }
  const v1Roles = ['executive', 'sales_rep', 'proposal_pm', 'bm', 'pmo', 'reviewer'];
  const roleV1 = v1Roles.includes(role) ? role : 'reviewer';

  let clientToken = req.cookies.get('wr_voter')?.value;
  if (!clientToken) clientToken = generateClientToken();

  const { rows: voterRows } = await db.query(
    `INSERT INTO voters (deal_id, display_name, client_token, role_v1)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (deal_id, display_name) DO UPDATE
     SET client_token = $3, role_v1 = $4
     RETURNING id, role, weight, role_v1`,
    [link.deal_id, display_name.trim(), clientToken, roleV1]
  );
  const voterId = voterRows[0].id;

  // 점수 계산 — question_answers 우선, legacyScores 폴백
  let finalScores: Record<string, number> = {};

  if (question_answers && Object.keys(question_answers).length > 0) {
    // 질문 목록 로드 후 sub_factor 점수 계산
    const { rows: questionRows } = await db.query(
      `SELECT * FROM question_items WHERE active=true ORDER BY display_order`
    );
    finalScores = computeSubScoresFromQuestions(questionRows, question_answers);
  } else if (legacyScores) {
    finalScores = legacyScores;
  }

  // votes upsert
  for (const [subId, score] of Object.entries(finalScores)) {
    const s = Math.max(1, Math.min(10, Math.round(Number(score))));
    await db.query(
      `INSERT INTO votes (voter_id, sub_factor_id, score, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (voter_id, sub_factor_id) DO UPDATE SET score = $3, updated_at = NOW()`,
      [voterId, subId, s]
    );
  }

  const { rows: countRows } = await db.query(
    'SELECT COUNT(DISTINCT id)::int as voter_count FROM voters WHERE deal_id = $1',
    [link.deal_id]
  );

  const res = NextResponse.json({
    ok: true,
    voter_count: countRows[0].voter_count,
    voter_id: voterId,
  });
  res.cookies.set('wr_voter', clientToken, { httpOnly: true, maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax' });
  return res;
}
