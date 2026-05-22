import { encode } from 'gpt-tokenizer';
import { splitParagraphs } from './textCleaner';

export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
  wordCount: number;
}

export interface ChunkOptions {
  targetTokens?: number;
  maxTokens?: number;
  minTokens?: number;
  overlapTokens?: number;
}

const DEFAULTS: Required<ChunkOptions> = {
  targetTokens: 300,
  maxTokens: 450,
  minTokens: 100,
  overlapTokens: 50,
};

function tokenLen(s: string): number {
  try {
    return encode(s).length;
  } catch {
    return Math.ceil(s.length / 2.2);
  }
}

function splitSentences(p: string): string[] {
  return p
    .split(/(?<=[.!?。！？])\s+|(?<=[.!?。！？])(?=[A-Z가-힣])|(?<=다\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function takeOverlap(prev: string, overlapTokens: number): string {
  if (!prev || overlapTokens <= 0) return '';
  const sentences = splitSentences(prev);
  const tail: string[] = [];
  let acc = 0;
  for (let i = sentences.length - 1; i >= 0; i--) {
    const t = tokenLen(sentences[i]);
    if (acc + t > overlapTokens) break;
    tail.unshift(sentences[i]);
    acc += t;
  }
  return tail.join(' ');
}

export function chunkText(text: string, opts: ChunkOptions = {}): Chunk[] {
  const o = { ...DEFAULTS, ...opts };
  const paragraphs = splitParagraphs(text);

  // 1단계: 문단을 토큰 수 기준으로 그룹핑
  const units: string[] = [];
  let buffer = '';
  let bufferTokens = 0;

  for (const p of paragraphs) {
    const pTokens = tokenLen(p);

    if (pTokens > o.maxTokens) {
      if (buffer) { units.push(buffer); buffer = ''; bufferTokens = 0; }
      const sentences = splitSentences(p);
      let sBuf = '';
      let sTok = 0;
      for (const s of sentences) {
        const st = tokenLen(s);
        if (sTok + st > o.targetTokens && sBuf) {
          units.push(sBuf);
          sBuf = s;
          sTok = st;
        } else {
          sBuf = sBuf ? `${sBuf} ${s}` : s;
          sTok += st;
        }
      }
      if (sBuf) units.push(sBuf);
      continue;
    }

    if (bufferTokens + pTokens > o.targetTokens && buffer) {
      units.push(buffer);
      buffer = p;
      bufferTokens = pTokens;
    } else {
      buffer = buffer ? `${buffer}\n\n${p}` : p;
      bufferTokens += pTokens;
    }
  }
  if (buffer) units.push(buffer);

  // 2단계: 너무 작은 청크를 인접 청크와 병합
  const merged: string[] = [];
  for (const u of units) {
    const t = tokenLen(u);
    if (merged.length > 0 && t < o.minTokens) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${u}`;
    } else {
      merged.push(u);
    }
  }

  // 3단계: 오버랩 적용
  const chunks: Chunk[] = [];
  for (let i = 0; i < merged.length; i++) {
    const overlap = i > 0 ? takeOverlap(merged[i - 1], o.overlapTokens) : '';
    const content = overlap ? `${overlap}\n\n${merged[i]}` : merged[i];
    chunks.push({
      index: i,
      content,
      tokenCount: tokenLen(content),
      wordCount: content.split(/\s+/).filter(Boolean).length,
    });
  }

  return chunks;
}
