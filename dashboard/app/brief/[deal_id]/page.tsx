import { notFound } from 'next/navigation';
import BriefSection from '@/components/BriefSection';
import '../print.css';

interface Props {
  params: Promise<{ deal_id: string }>;
  searchParams: Promise<{ regenerate?: string }>;
}

export default async function BriefPage({ params, searchParams }: Props) {
  const { deal_id } = await params;
  const { regenerate } = await searchParams;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  // regenerate=1 → POST で再生成, それ以外は GET でキャッシュ取得
  let data: Record<string, unknown> | null = null;
  try {
    if (regenerate === '1') {
      const res = await fetch(`${baseUrl}/api/brief/${deal_id}`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (res.ok) data = await res.json();
    } else {
      // まずキャッシュ確認
      const res = await fetch(`${baseUrl}/api/brief/${deal_id}`, { cache: 'no-store' });
      if (res.ok) {
        data = await res.json();
      } else {
        // キャッシュなし → 自動生成
        const postRes = await fetch(`${baseUrl}/api/brief/${deal_id}`, {
          method: 'POST',
          cache: 'no-store',
        });
        if (postRes.ok) data = await postRes.json();
      }
    }
  } catch {
    // ignore fetch errors
  }

  if (!data || data.error) {
    notFound();
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
