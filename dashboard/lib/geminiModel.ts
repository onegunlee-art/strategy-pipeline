// Gemini 모델 단일 소스. 무료 티어에서 gemini-2.5-pro 한도가 0으로 막혀
// 기본값을 gemini-2.5-flash로 둔다. GEMINI_MODEL 환경변수로 override 가능.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

// 키 이름 대소문자 혼용 대응 (Vercel 환경에 따라 다를 수 있음)
export const GEMINI_KEY =
  process.env.GEMINI_API_KEY ??
  process.env.Gemini_Api_Key ??
  process.env.Gemini_API_Key ??
  process.env.GOOGLE_API_KEY;
