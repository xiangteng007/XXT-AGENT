import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '市場監控',
  description: '即時報價、技術指標、自選清單和交易信號',
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
