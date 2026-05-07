import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { calculateProbability, Variables } from '@/lib/algorithm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_name, deal_size, variables } = body as {
      client_name: string;
      deal_size?: string;
      variables: Variables;
    };

    const db = getDb();

    const weights: Record<string, number> = {};
    const rows = db
      .prepare(`
        SELECT variable_id, weight_value FROM weights w
        WHERE updated_at = (
          SELECT MAX(updated_at) FROM weights w2 WHERE w2.variable_id = w.variable_id
        )
      `)
      .all() as { variable_id: string; weight_value: number }[];
    rows.forEach(r => { weights[r.variable_id] = r.weight_value; });

    const probability = calculateProbability(variables, weights);

    const dealResult = db
      .prepare('INSERT INTO deals (client_name, deal_size) VALUES (?, ?)')
      .run(client_name, deal_size ?? null);

    db.prepare(
      'INSERT INTO predictions (deal_id, variables_json, predicted_probability, weights_used_json) VALUES (?, ?, ?, ?)'
    ).run(dealResult.lastInsertRowid, JSON.stringify(variables), probability, JSON.stringify(weights));

    return NextResponse.json({ probability, deal_id: dealResult.lastInsertRowid, weights });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
