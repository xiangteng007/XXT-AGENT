import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '保險守衛',
  description: '保單管理、到期追蹤與理賠保障分析 — 全面掌握您的保險保障',
  openGraph: {
    title: '保險守衛 | XXT Dashboard',
    description: '保單管理、到期追蹤與理賠保障分析',
  },
};

export default function GuardianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
