// DART enrichment 오케스트레이터.
// 등록된 corp_map의 모든 회사 또는 특정 회사의 최근 공시를 수집·요약·저장.
import { fetchFilingList, isDartOk, isDartEmpty } from './client';
import { existsByRceptNo, saveFiling } from './filingCache';
import { summarizeFiling } from './summarizer';
import { listCorpMap, resolveCorpCode } from './entityResolver';

export interface SyncResult {
  corp_code: string;
  corp_name: string;
  fetched: number;
  new_filings: number;
  skipped_duplicates: number;
  summarized: number;
  errors: string[];
}

export async function syncFilings(opts: {
  corp_code?: string;
  customer_name?: string;
  days?: number;
  skip_summary?: boolean;
}): Promise<SyncResult[]> {
  const days = opts.days ?? 90;

  // 대상 회사 결정
  const corps: { corp_code: string; corp_name: string; is_listed: boolean }[] = [];
  if (opts.corp_code) {
    const all = await listCorpMap();
    const c = all.find((r) => r.corp_code === opts.corp_code);
    if (c) corps.push({ corp_code: c.corp_code, corp_name: c.corp_name, is_listed: c.is_listed });
  } else if (opts.customer_name) {
    const r = await resolveCorpCode(opts.customer_name);
    if (r) corps.push({ corp_code: r.corp_code, corp_name: r.corp_name, is_listed: r.is_listed });
  } else {
    const all = await listCorpMap();
    for (const r of all) corps.push({ corp_code: r.corp_code, corp_name: r.corp_name, is_listed: r.is_listed });
  }

  const results: SyncResult[] = [];

  for (const c of corps) {
    const result: SyncResult = {
      corp_code: c.corp_code,
      corp_name: c.corp_name,
      fetched: 0,
      new_filings: 0,
      skipped_duplicates: 0,
      summarized: 0,
      errors: [],
    };

    if (!c.is_listed) {
      result.errors.push('not listed — DART 데이터 없음');
      results.push(result);
      continue;
    }

    try {
      const resp = await fetchFilingList({ corp_code: c.corp_code, days });
      if (isDartEmpty(resp)) {
        results.push(result);
        continue;
      }
      if (!isDartOk(resp)) {
        result.errors.push(`DART status=${resp.status} ${resp.message}`);
        results.push(result);
        continue;
      }
      const list = resp.list ?? [];
      result.fetched = list.length;

      for (const raw of list) {
        if (await existsByRceptNo(raw.rcept_no)) {
          result.skipped_duplicates++;
          continue;
        }
        let summary = null;
        if (!opts.skip_summary) {
          try {
            summary = await summarizeFiling(raw);
            result.summarized++;
          } catch (e) {
            result.errors.push(`summarize failed for ${raw.rcept_no}: ${e instanceof Error ? e.message : e}`);
          }
        }
        await saveFiling(raw, summary);
        result.new_filings++;
      }
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }

    results.push(result);
  }

  return results;
}
