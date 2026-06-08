// Gemini 모델 단일 소스. 무료 티어에서 gemini-2.5-pro 한도가 0으로 막혀
// 기본값을 gemini-2.5-flash로 둔다. GEMINI_MODEL 환경변수로 override 가능.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

// 키 이름 대소문자/표기 혼용 대응 (Vercel 환경에 따라 다를 수 있음).
// 등록 시 흔히 쓰이는 변형을 모두 탐색한다.
const GEMINI_KEY_CANDIDATES: Record<string, string | undefined> = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_KEY: process.env.GEMINI_KEY,
  Gemini_Api_Key: process.env.Gemini_Api_Key,
  Gemini_API_Key: process.env.Gemini_API_Key,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,
};

const matchedKeyName = Object.keys(GEMINI_KEY_CANDIDATES).find(
  k => (GEMINI_KEY_CANDIDATES[k] ?? '').trim().length > 0
);

// 값은 절대 로깅하지 않고, 어떤 환경변수 이름이 잡혔는지만 남긴다.
if (!matchedKeyName) {
  console.error('[geminiModel] No Gemini API key found. Checked:', Object.keys(GEMINI_KEY_CANDIDATES).join(', '));
} else {
  console.log('[geminiModel] Using key from env var:', matchedKeyName);
}

export const GEMINI_KEY = matchedKeyName ? GEMINI_KEY_CANDIDATES[matchedKeyName]?.trim() : undefined;
