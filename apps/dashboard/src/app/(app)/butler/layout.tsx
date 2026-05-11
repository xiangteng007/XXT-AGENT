import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '個人管家',
  description: '財務管理、行事曆、健康追蹤和車輛管理',
};

export default function ButlerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
