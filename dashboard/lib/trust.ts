// 모델 신뢰수준 — "이 확률을 얼마나 믿어야 하나"를 정직하게 표기.
// 학습 라벨(outcome) 수가 적으면 확률은 전문가 구조 추정일 뿐 보정된 값이 아니다.
// 이 사실을 UI에 숨기지 않고 드러내는 것이 Phase 1(정직성)의 핵심.

export type TrustLevel = 'structural' | 'low' | 'medium' | 'high';

export interface ModelTrust {
  level: TrustLevel;
  label: string;          // 한국어 배지 문구
  detail: string;         // 한 줄 설명
  labeled_count: number;  // 결과(승/패)가 확정된 학습 표본 수
  brier: number | null;   // 평균 Brier (낮을수록 정확), 표본 없으면 null
  color: string;          // 배지 색
}

// labeledCount: outcome이 확정된 prediction 수
// brier: 평균 Brier score (0~1, 낮을수록 좋음) — 표본 없으면 null
export function computeModelTrust(labeledCount: number, brier: number | null): ModelTrust {
  if (labeledCount <= 0) {
    return {
      level: 'structural',
      label: '구조 추정',
      detail: '결과 데이터가 없어 전문가 구조(Pillar)만으로 산출된 값입니다. 아직 보정되지 않았습니다.',
      labeled_count: 0, brier: null, color: '#6b7280',
    };
  }
  if (labeledCount < 10) {
    return {
      level: 'low',
      label: `낮음 · ${labeledCount}건`,
      detail: `학습 표본 ${labeledCount}건으로 통계적 보정이 미약합니다. 참고용으로만 활용하세요.`,
      labeled_count: labeledCount, brier, color: '#dc2626',
    };
  }
  if (labeledCount < 30) {
    return {
      level: 'medium',
      label: `중간 · ${labeledCount}건`,
      detail: `학습 표본 ${labeledCount}건. 보정이 시작됐으나 분포 추정엔 30건+ 권장.`,
      labeled_count: labeledCount, brier, color: '#d97706',
    };
  }
  return {
    level: 'high',
    label: `높음 · ${labeledCount}건`,
    detail: brier != null
      ? `학습 표본 ${labeledCount}건, 평균 Brier ${brier.toFixed(3)}. 데이터로 보정된 값입니다.`
      : `학습 표본 ${labeledCount}건. 데이터로 보정된 값입니다.`,
    labeled_count: labeledCount, brier, color: '#16a34a',
  };
}
