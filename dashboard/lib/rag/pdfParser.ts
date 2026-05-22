import { cleanText } from './textCleaner';

export interface ParseResult {
  text: string;
  wordCount: number;
  charCount: number;
  pageCount: number;
  needsOcr: boolean;
}

/**
 * PDF에서 텍스트 추출. 추출 결과가 너무 짧으면 needsOcr=true.
 * OCR fallback은 별도 처리 (GOOGLE_CLOUD_VISION_KEY 설정 시 활성).
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParseResult> {
  // dynamic import로 pdf-parse 로드 (Next.js bundler 회피)
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  const cleaned = cleanText(data.text || '');
  const needsOcr = cleaned.wordCount < 100 && (data.numpages ?? 0) > 0;
  return {
    text: cleaned.text,
    wordCount: cleaned.wordCount,
    charCount: cleaned.charCount,
    pageCount: data.numpages ?? 0,
    needsOcr,
  };
}

export async function parseTextBuffer(buffer: Buffer): Promise<ParseResult> {
  const raw = buffer.toString('utf8');
  const cleaned = cleanText(raw);
  return {
    text: cleaned.text,
    wordCount: cleaned.wordCount,
    charCount: cleaned.charCount,
    pageCount: 1,
    needsOcr: false,
  };
}

export async function parseFile(filename: string, buffer: Buffer): Promise<ParseResult> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return parsePdfBuffer(buffer);
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return parseTextBuffer(buffer);
  // HWP/DOC은 Phase 2 — 일단 텍스트로 시도
  return parseTextBuffer(buffer);
}
