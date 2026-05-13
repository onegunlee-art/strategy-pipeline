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

    const db = await getDb();

    const { rows } = await db.query(`
      SELECT variable_id, weight_value FROM weights w
      WHERE updated_at = (
        SELECT MAX(updated_at) FROM weights w2 WHERE w2.variable_id = w.variable_id
      )
    `);

    const weights: Record<string, number> = {};
    rows.forEach((r: { variable_id: string; weight_value: number }) => {
      weights[r.variable_id] = r.weight_value;
    });

    const probability = calculateProbability(variables, weights);

    const { rows: dealRows } = await db.query(
      'INSERT INTO deals (client_name, deal_size) VALUES ($1, $2) RETURNING id',
      [client_name, deal_size ?? null]
    );
    const dealId = dealRows[0].id;

    await db.query(
      'INSERT INTO predictions (deal_id, variables_json, predicted_probability, weights_used_json) VALUES ($1, $2, $3, $4)',
      [dealId, JSON.stringify(variables), probability, JSON.stringify(weights)]
    );

    return NextResponse.json({ probability, deal_id: dealId, weights });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
