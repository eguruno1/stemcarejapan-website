import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StemCareJapan 상담 관리자',
  description: '운영자 상담 관리 화면'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
