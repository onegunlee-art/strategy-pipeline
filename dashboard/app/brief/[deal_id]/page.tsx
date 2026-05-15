import { headers } from 'next/headers';
import BriefSection from '@/components/BriefSection';
import '../print.css';

interface Props {
  params: Promise<{ deal_id: string }>;
  searchParams: Promise<{ regenerate?: string }>;
}

export default async function BriefPage({ params, searchParams }: Props) {
  const { deal_id } = await params;
  const { regenerate } = await searchParams;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? (host ? `${proto}://${host}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));

  let data: Record<string, unknown> | null = null;
  let errorMsg: string | null = null;
  try {
    if (regenerate === '1') {
      const res = await fetch(`${baseUrl}/api/brief/${deal_id}`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (res.ok) data = await res.json();
      else errorMsg = `POST ${res.status}: ${await res.text()}`;
    } else {
      const res = await fetch(`${baseUrl}/api/brief/${deal_id}`, { cache: 'no-store' });
      if (res.ok) {
        data = await res.json();
      } else {
        const postRes = await fetch(`${baseUrl}/api/brief/${deal_id}`, {
          method: 'POST',
          cache: 'no-store',
        });
        if (postRes.ok) data = await postRes.json();
        else errorMsg = `POST ${postRes.status}: ${await postRes.text()}`;
      }
    }
  } catch (e) {
    errorMsg = `fetch error: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (!data || data.error) {
    return (
      <div style={{ padding: '40px', fontFamily: 'monospace', color: '#e0e0e0', background: '#0d0d0d', minHeight: '100vh' }}>
        <h1>Executive Brief 생성 실패</h1>
        <p>deal_id: {deal_id}</p>
        <p>baseUrl: {baseUrl}</p>
        <pre style={{ background: '#1a1a1a', padding: '12px', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
          {errorMsg ?? (data?.error as string) ?? 'unknown error'}
        </pre>
        <p style={{ marginTop: '24px', color: '#888' }}>
          GEMINI_API_KEY 환경변수 확인 / deal_id 존재 여부 확인 / Vercel Function Logs 확인
        </p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #0d0d0d)',
      color: 'var(--text, #e0e0e0)',
    }}>
      <BriefSection data={data as unknown as Parameters<typeof BriefSection>[0]['data']} />
    </div>
  );
}
