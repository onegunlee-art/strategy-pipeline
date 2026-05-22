import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    client = new OpenAI({ apiKey });
  }
  return client;
}

const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;
const BATCH_SIZE = 100;

export async function embedText(text: string): Promise<number[]> {
  const c = getClient();
  const res = await c.embeddings.create({
    model: MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const c = getClient();
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE);
    const res = await c.embeddings.create({
      model: MODEL,
      input: slice,
    });
    for (const item of res.data) {
      results[i + item.index] = item.embedding;
    }
  }
  return results;
}

export const EMBEDDING_DIMENSIONS = DIMENSIONS;
export const EMBEDDING_MODEL = MODEL;
