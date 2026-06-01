// 공유 도메인 타입 — page/admin/charts 에 흩어져 있던 중복 정의를 단일화.
// 각 정의는 흩어져 있던 변형들의 superset(상위집합)으로, 선택 필드는 optional 처리.

export interface Partner {
  name: string;
  role: string;
  description?: string;
  task_scope?: string;
}

export interface Risk {
  name: string;
  probability: number;
  impact: number;
  difficulty: number;
  level: string;
}

export interface Milestone {
  date: string;
  label: string;
  type: string;       // 'deadline' | 'event' | 'today' | string
}

export interface BidTimeline {
  rfp_published?: string;
  bid_deadline?: string;
  pt_date?: string;
  announcement_date?: string;
}

export interface CompPos {
  self?: { x: number; y: number };
  competitors?: {
    name: string; x: number; y: number;
    size?: string; notes?: string; risk_level?: string;
  }[];
}
