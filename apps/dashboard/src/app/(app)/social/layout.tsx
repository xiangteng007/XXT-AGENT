import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '社群監控',
  description: '社群情緒分析、帳號管理和數據報告',
};

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
