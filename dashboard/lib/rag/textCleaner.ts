const BOILERPLATE_PATTERNS: RegExp[] = [
  /^\s*\d+\s*\/\s*\d+\s*$/gm,
  /^\s*-\s*\d+\s*-\s*$/gm,
  /Page \d+ of \d+/gi,
  /본 문서는.{0,80}(대외비|기밀|confidential)/gi,
  /Copyright\s*[©(c)]+\s*\d{4}.{0,80}/gi,
  /All rights reserved\.?/gi,
  /\bDRAFT\s*v?\d*\.?\d*\b/gi,
];

export interface CleanResult {
  text: string;
  wordCount: number;
  charCount: number;
}

export function cleanText(raw: string): CleanResult {
  let t = raw;

  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/ /g, ' ');
  t = t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

  for (const pat of BOILERPLATE_PATTERNS) {
    t = t.replace(pat, '');
  }

  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.split('\n').map((l) => l.trim()).join('\n').trim();

  const wordCount = t.split(/\s+/).filter(Boolean).length;
  return { text: t, wordCount, charCount: t.length };
}

export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
}
