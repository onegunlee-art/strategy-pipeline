import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getLabels } from '@/lib/labels';
import { randomBytes } from 'crypto';

function generateClientToken(): string {
  return randomBytes(16).toString('hex');
}

// GET /api/vote/[token] — 딜 정보 + 레이블 + 내 이전 표
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
  let myVotes: Record<string, number> = {};
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
      myVoter = { id: voterRows[0].id, display_name: voterRows[0].display_name, role: voterRows[0].role, weight: voterRows[0].weight };
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

  const labels = await getLabels();

  return NextResponse.json({
    deal_id: link.deal_id,
    client_name: link.client_name,
    deal_size: link.deal_size,
    closes_at: link.closes_at,
    is_closed: isClosed,
    labels: labels.subFactors,
    pillar_labels: labels.pillars,
    my_voter: myVoter,
    my_votes: myVotes,
    voter_count: countRows[0].voter_count,
  });
}

// POST /api/vote/[token] — 투표 제출 (upsert)
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = await getDb();

  // 링크 유효성 확인
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

  const { display_name, scores } = await req.json();
  // scores: Record<sub_factor_id, number>
  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'display_name 필수' }, { status: 400 });
  }

  // client_token 쿠키 — 재방문 식별
  let clientToken = req.cookies.get('wr_voter')?.value;
  if (!clientToken) clientToken = generateClientToken();

  // voters upsert (같은 딜에 같은 이름이면 기존 voter 사용, client_token 업데이트)
  const { rows: voterRows } = await db.query(
    `INSERT INTO voters (deal_id, display_name, client_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (deal_id, display_name) DO UPDATE SET client_token = $3
     RETURNING id, role, weight`,
    [link.deal_id, display_name.trim(), clientToken]
  );
  const voterId = voterRows[0].id;

  // votes upsert
  for (const [subId, score] of Object.entries(scores as Record<string, number>)) {
    const s = Math.max(1, Math.min(10, Math.round(Number(score))));
    await db.query(
      `INSERT INTO votes (voter_id, sub_factor_id, score, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (voter_id, sub_factor_id) DO UPDATE SET score = $3, updated_at = NOW()`,
      [voterId, subId, s]
    );
  }

  // 집계 voterCount 반환
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
