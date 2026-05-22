// DART OpenAPI 클라이언트. 무료 API key 필요: opendart.fss.or.kr
// 환경변수: DART_API_KEY

const BASE = 'https://opendart.fss.or.kr/api';

export interface DartFilingRaw {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  corp_cls: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

export interface DartListResponse {
  status: string;
  message: string;
  page_no?: number;
  page_count?: number;
  total_count?: number;
  total_page?: number;
  list?: DartFilingRaw[];
}

export interface DartCompanyResponse {
  status: string;
  message: string;
  corp_code?: string;
  corp_name?: string;
  corp_name_eng?: string;
  stock_name?: string;
  stock_code?: string;
  ceo_nm?: string;
  corp_cls?: string;
  jurir_no?: string;
  bizr_no?: string;
  adres?: string;
  hm_url?: string;
  ir_url?: string;
  phn_no?: string;
  fax_no?: string;
  induty_code?: string;
  est_dt?: string;
  acc_mt?: string;
}

function getApiKey(): string {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error('DART_API_KEY is not set');
  return key;
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export async function fetchFilingList(params: {
  corp_code: string;
  bgn_de?: string;
  end_de?: string;
  days?: number;
  page_no?: number;
  page_count?: number;
}): Promise<DartListResponse> {
  const url = new URL(`${BASE}/list.json`);
  url.searchParams.set('crtfc_key', getApiKey());
  url.searchParams.set('corp_code', params.corp_code);

  if (params.bgn_de) {
    url.searchParams.set('bgn_de', params.bgn_de);
  } else if (params.days) {
    const start = new Date(Date.now() - params.days * 86400 * 1000);
    url.searchParams.set('bgn_de', formatDate(start));
  }
  if (params.end_de) url.searchParams.set('end_de', params.end_de);
  url.searchParams.set('page_no', String(params.page_no ?? 1));
  url.searchParams.set('page_count', String(params.page_count ?? 100));

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`DART list.json HTTP ${res.status}`);
  return res.json();
}

export async function fetchCompany(corp_code: string): Promise<DartCompanyResponse> {
  const url = new URL(`${BASE}/company.json`);
  url.searchParams.set('crtfc_key', getApiKey());
  url.searchParams.set('corp_code', corp_code);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`DART company.json HTTP ${res.status}`);
  return res.json();
}

// Status code reference (DART 공통):
// 000 정상 / 010 등록되지 않은 키 / 011 사용할 수 없는 키
// 013 조회된 데이터 없음 / 020 요청 제한 초과 / 100 필수값 누락
export function isDartOk(r: { status: string }): boolean {
  return r.status === '000';
}
export function isDartEmpty(r: { status: string }): boolean {
  return r.status === '013';
}
