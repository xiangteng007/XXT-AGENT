// Mock data for social system

export interface SocialReport {
    id: string;
    name: string;
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    status: 'completed' | 'processing' | 'failed';
    generatedAt: string;
    period: { start: string; end: string };
    metrics: {
        totalPosts: number;
        avgSentiment: number;
        topAccounts: number;
        alerts: number;
    };
    downloadUrls?: { pdf?: string; excel?: string };
}

export const mockSocialReports: SocialReport[] = [
    {
        id: '1', name: '每日社群監控報告', type: 'daily', status: 'completed',
        generatedAt: new Date().toISOString(),
        period: { start: '2026-01-16', end: '2026-01-16' },
        metrics: { totalPosts: 1250, avgSentiment: 0.65, topAccounts: 15, alerts: 3 },
        downloadUrls: { pdf: '#', excel: '#' },
    },
    {
        id: '2', name: '每週社群趨勢報告', type: 'weekly', status: 'completed',
        generatedAt: new Date(Date.now() - 86400000).toISOString(),
        period: { start: '2026-01-10', end: '2026-01-16' },
        metrics: { totalPosts: 8750, avgSentiment: 0.58, topAccounts: 42, alerts: 12 },
        downloadUrls: { pdf: '#', excel: '#' },
    },
    {
        id: '3', name: '每月綜合分析報告', type: 'monthly', status: 'processing',
        generatedAt: new Date(Date.now() - 172800000).toISOString(),
        period: { start: '2025-12-01', end: '2025-12-31' },
        metrics: { totalPosts: 35200, avgSentiment: 0.62, topAccounts: 128, alerts: 45 },
    },
];
