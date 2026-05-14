'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

/** Mapping of path segments to display labels */
const SEGMENT_LABELS: Record<string, string> = {
  butler: '個人管家',
  finance: '財務管理',
  calendar: '行事曆',
  health: '健康追蹤',
  vehicle: '車輛管理',
  chat: 'AI 對話',
  admin: 'LINE Bot 管理',
  market: '市場監控',
  quotes: '即時報價',
  watchlist: '自選清單',
  heatmap: '熱力圖',
  signals: '交易信號',
  indicators: '技術指標',
  alerts: '警報設定',
  news: '新聞監控',
  feed: '動態',
  analysis: '分析',
  sources: '來源管理',
  social: '社群監控',
  sentiment: '情緒分析',
  analytics: '數據分析',
  accounts: '帳號管理',
  reports: '報告',
  settings: '設定',
  events: '融合事件',
  timeline: '時間軸',
  ai: 'AI 助理',
  agents: '代理人目錄',
  portfolio: '投資組合',
  guardian: '保險守衛',
  scout: 'UAV 任務',
  lex: '合約法務',
  zora: '協會管理',
  tenants: '租戶管理',
  team: '團隊',
  members: '團隊成員',
  rules: '規則設定',
  mappings: '關鍵字對應',
  jobs: '排程任務',
  logs: '系統日誌',
  metrics: '系統指標',
  system: '運維中心',
  linebot: 'LINE Bot',
  telegram: 'Telegram Bot',
  'link-telegram': 'Telegram 綁定',
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Don't show on root
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = SEGMENT_LABELS[segment] || segment;
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '13px',
        color: 'var(--text-muted, #64748b)',
        marginBottom: '16px',
        padding: '0 4px',
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          transition: 'color 0.15s',
        }}
        title="首頁"
      >
        <Home size={14} />
      </Link>
      {crumbs.map((crumb) => (
        <React.Fragment key={crumb.href}>
          <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
          {crumb.isLast ? (
            <span
              style={{
                fontWeight: 500,
                color: 'var(--text-primary, #1a1a2e)',
              }}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              style={{
                color: 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
