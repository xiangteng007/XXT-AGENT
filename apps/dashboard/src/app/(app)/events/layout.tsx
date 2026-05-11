import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '融合事件',
  description: '跨源事件融合、時間軸和 AI 分析',
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
