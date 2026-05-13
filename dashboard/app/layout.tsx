import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WIN-RATE | B2B 수주 예측 대시보드',
  description: 'AI 기반 B2B 수주 확률 계산 및 자가학습 시스템',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
