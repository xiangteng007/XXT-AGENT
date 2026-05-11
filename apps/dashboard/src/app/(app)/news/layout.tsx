import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '新聞監控',
  description: '即時新聞、AI 分析、警報管理和來源設定',
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
