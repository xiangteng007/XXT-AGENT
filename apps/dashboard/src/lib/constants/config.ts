// Centralized color and icon configurations

import { TrendingUp, TrendingDown, Minus, CheckCircle, Zap } from 'lucide-react';

// Severity configurations
export const severityConfig = {
    low: { label: '低', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    medium: { label: '中', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
    high: { label: '高', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
    critical: { label: '緊急', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
} as const;

// Sentiment configurations
export const sentimentConfig = {
    bullish: { label: '看多', color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900' },
    bearish: { label: '看空', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900' },
    neutral: { label: '中性', color: 'text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-900' },
    mixed: { label: '混合', color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900' },
} as const;

// News source icons
export const sourceIcons: Record<string, string> = {
    reuters: '📰', bloomberg: '💹', wsj: '📊', cnbc: '📺',
    yahoo: '🔮', google: '🔍', local: '🏠', cnyes: '🏦',
    udn: '📋', other: '📋',
};

// Topic labels for news
export const topicLabels = {
    earnings: { label: '財報', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    merger: { label: '併購', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    regulation: { label: '監管', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
    macro: { label: '總經', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    tech: { label: '科技', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
    crypto: { label: '加密貨幣', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
    commodity: { label: '大宗商品', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    forex: { label: '外匯', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' },
    politics: { label: '政治', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
    other: { label: '其他', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300' },
} as const;

// Report type labels
export const reportTypeLabels = {
    daily: { label: '每日', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    weekly: { label: '每週', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    monthly: { label: '每月', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    custom: { label: '自訂', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
} as const;

// Alert type labels for market alerts
export const alertTypeLabels = {
    price_above: { label: '價格突破', icon: '📈' },
    price_below: { label: '價格跌破', icon: '📉' },
    pct_change: { label: '漲跌幅度', icon: '📊' },
    volume_spike: { label: '成交量異常', icon: '📶' },
    rsi_overbought: { label: 'RSI 超買', icon: '🔴' },
    rsi_oversold: { label: 'RSI 超賣', icon: '🟢' },
} as const;

// Event type configurations
export const eventTypeConfig = {
    news: { label: '新聞', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900' },
    social: { label: '社群', color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900' },
    market: { label: '市場', color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900' },
    alert: { label: '警報', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900' },
} as const;

// Gradient classes for cards
export const gradientClasses = {
    blue: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
    green: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900',
    purple: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
    orange: 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900',
    red: 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900',
} as const;

export type SeverityLevel = keyof typeof severityConfig;
export type SentimentType = keyof typeof sentimentConfig;
export type TopicType = keyof typeof topicLabels;
export type ReportType = keyof typeof reportTypeLabels;
export type AlertType = keyof typeof alertTypeLabels;
export type EventType = keyof typeof eventTypeConfig;
