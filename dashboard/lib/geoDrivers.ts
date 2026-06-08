// 토픽별 동적 드라이버 — 단일 진실 공급원(Single Source of Truth).
// 확률 공식과 invert 로직이 page.tsx / geoAggregate.ts / report page 에 중복돼 있던 것을
// 여기로 통합한다. 모든 곳이 이 헬퍼를 import 해야 클라/서버 확률이 일치한다.

export interface GeoDriver {
  key: string;       // 안정 슬러그: 'd1'~'d5' (Gemini 키 드리프트 차단용)
  labelKo: string;   // 한글 라벨 (드라이버 패널)
  labelEn: string;   // 짧은 영문 라벨 (레이더 축)
  invert: boolean;   // true면 값이 높을수록 종전 가능성 ↓ → contribution = 10 - raw
}

// 드라이버 막대/레이더 색상 팔레트 (index 기반 할당)
export const DRIVER_COLORS = [
  'var(--green)',
  'var(--red)',
  'var(--yellow)',
  'var(--cyan, #0ea5e9)',
  'var(--brand)',
];

// AI 실패 시 사용할 범용 5축 (이란 전용이 아님)
export const FALLBACK_DRIVER_META: GeoDriver[] = [
  { key: 'd1', labelKo: '외교 채널',  labelEn: 'Diplomacy',     invert: false },
  { key: 'd2', labelKo: '군사 강도',  labelEn: 'Military',      invert: true  },
  { key: 'd3', labelKo: '경제 압박',  labelEn: 'Economy',       invert: true  },
  { key: 'd4', labelKo: '내부 안정',  labelEn: 'Domestic',      invert: false },
  { key: 'd5', labelKo: '외부 개입',  labelEn: 'External',      invert: true  },
];

export const FALLBACK_DRIVER_SCORES: Record<string, number> = {
  d1: 3, d2: 7, d3: 7, d4: 4, d5: 6,
};

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

// 종전 기여도(0~10): invert면 뒤집는다.
export function contribution(driver: GeoDriver, raw: number): number {
  const v = typeof raw === 'number' && !isNaN(raw) ? raw : 0;
  return driver.invert ? 10 - v : v;
}

// 종전 가능성(5~95). 기여도 평균 * 10.
export function computeGeoProb(
  meta: GeoDriver[],
  scores: Record<string, number>
): number {
  if (!Array.isArray(meta) || meta.length === 0) return 50;
  const sum = meta.reduce((acc, m) => acc + contribution(m, scores[m.key] ?? 0), 0);
  const mean = sum / meta.length;
  return clamp(5, 95, Math.round(mean * 10));
}

// 임의 입력(JSONB 등)을 GeoDriver[]로 정규화. 비정상이면 fallback.
export function normalizeDriverMeta(raw: unknown): GeoDriver[] {
  if (!Array.isArray(raw) || raw.length === 0) return FALLBACK_DRIVER_META;
  const out: GeoDriver[] = [];
  for (let i = 0; i < raw.length; i++) {
    const d = raw[i] as Partial<GeoDriver> | null;
    if (!d || typeof d !== 'object') continue;
    out.push({
      key: typeof d.key === 'string' && d.key ? d.key : `d${i + 1}`,
      labelKo: typeof d.labelKo === 'string' && d.labelKo ? d.labelKo : `드라이버 ${i + 1}`,
      labelEn: typeof d.labelEn === 'string' && d.labelEn ? d.labelEn : `Driver ${i + 1}`,
      invert: d.invert === true,
    });
  }
  return out.length > 0 ? out : FALLBACK_DRIVER_META;
}
