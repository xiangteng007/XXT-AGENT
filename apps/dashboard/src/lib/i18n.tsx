/**
 * XXT Dashboard i18n System
 * Lightweight translation system with React context
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Locale = 'zh-TW' | 'en';

// Translation dictionary type
type TranslationDict = Record<string, string>;

const translations: Record<Locale, TranslationDict> = {
  'zh-TW': {
    // Navigation
    'nav.overview': '總覽',
    'nav.butler': '個人管家',
    'nav.market': '市場監控',
    'nav.news': '新聞監控',
    'nav.social': '社群監控',
    'nav.portfolio': '投資組合',
    'nav.events': '融合事件',
    'nav.ai': 'AI 助理',
    'nav.guardian': '保險守衛',
    'nav.scout': 'UAV 任務',
    'nav.lex': '合約法務',
    'nav.zora': '協會管理',
    'nav.agents': '代理人',
    'nav.settings': '設定',
    'nav.system': '系統',

    // Common
    'common.loading': '載入中...',
    'common.error': '發生錯誤',
    'common.retry': '重試',
    'common.save': '儲存',
    'common.cancel': '取消',
    'common.delete': '刪除',
    'common.edit': '編輯',
    'common.add': '新增',
    'common.search': '搜尋',
    'common.filter': '篩選',
    'common.export': '匯出',
    'common.refresh': '重新整理',
    'common.confirm': '確認',
    'common.back': '返回',
    'common.noData': '暫無資料',
    'common.demoMode': '展示模式',

    // Status
    'status.active': '有效',
    'status.expired': '已過期',
    'status.cancelled': '已取消',
    'status.running': '運行中',
    'status.stopped': '已停止',
    'status.healthy': '健康',
    'status.unhealthy': '異常',

    // Guardian
    'guardian.title': '保險守衛',
    'guardian.subtitle': '保單管理、到期追蹤與理賠保障分析',
    'guardian.addPolicy': '新增保單',
    'guardian.editPolicy': '編輯保單',
    'guardian.totalPolicies': '保單總數',
    'guardian.activePolicies': '有效保單',
    'guardian.annualPremium': '年度總保費',
    'guardian.pendingLink': '待連結帳務',
    'guardian.expiryAlert': '到期提醒',

    // Market
    'market.title': '市場監控',
    'market.quotes': '即時報價',
    'market.heatmap': '熱力圖',
    'market.signals': '交易信號',
    'market.watchlist': '自選清單',
  },

  'en': {
    // Navigation
    'nav.overview': 'Overview',
    'nav.butler': 'Personal Butler',
    'nav.market': 'Market Monitor',
    'nav.news': 'News Monitor',
    'nav.social': 'Social Monitor',
    'nav.portfolio': 'Portfolio',
    'nav.events': 'Fused Events',
    'nav.ai': 'AI Assistant',
    'nav.guardian': 'Guardian',
    'nav.scout': 'UAV Missions',
    'nav.lex': 'Legal',
    'nav.zora': 'Association',
    'nav.agents': 'Agents',
    'nav.settings': 'Settings',
    'nav.system': 'System',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.retry': 'Retry',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.refresh': 'Refresh',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.noData': 'No data available',
    'common.demoMode': 'Demo Mode',

    // Status
    'status.active': 'Active',
    'status.expired': 'Expired',
    'status.cancelled': 'Cancelled',
    'status.running': 'Running',
    'status.stopped': 'Stopped',
    'status.healthy': 'Healthy',
    'status.unhealthy': 'Unhealthy',

    // Guardian
    'guardian.title': 'Guardian',
    'guardian.subtitle': 'Policy management, expiry tracking & claims analysis',
    'guardian.addPolicy': 'Add Policy',
    'guardian.editPolicy': 'Edit Policy',
    'guardian.totalPolicies': 'Total Policies',
    'guardian.activePolicies': 'Active Policies',
    'guardian.annualPremium': 'Annual Premium',
    'guardian.pendingLink': 'Pending Linkage',
    'guardian.expiryAlert': 'Expiry Alert',

    // Market
    'market.title': 'Market Monitor',
    'market.quotes': 'Live Quotes',
    'market.heatmap': 'Heatmap',
    'market.signals': 'Signals',
    'market.watchlist': 'Watchlist',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'zh-TW',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children, defaultLocale = 'zh-TW' }: { children: ReactNode; defaultLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('xxt-locale', newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    return translations[locale]?.[key] ?? fallback ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { translations };
