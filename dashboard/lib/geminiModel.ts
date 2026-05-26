// Gemini 모델 단일 소스. 무료 티어에서 gemini-2.5-pro 한도가 0으로 막혀
// 기본값을 gemini-2.5-flash로 둔다. GEMINI_MODEL 환경변수로 override 가능.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
