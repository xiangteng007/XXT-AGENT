// Mock data for news system

export interface NotificationChannels {
    telegram: boolean;
    line: boolean;
    email: boolean;
}

export interface NewsAlertRule {
    id: string;
    name: string;
    enabled: boolean;
    keywords: string[];
    symbols: string[];
    minSeverity: number;
    channels: NotificationChannels;
    cooldownMinutes: number;
    triggerCount: number;
}

// Simplified mock source type (not using NewsSourceConfig to avoid type conflicts)
export interface MockNewsSource {
    id: string;
    name: string;
    key: string;
    enabled: boolean;
    priority: number;
    refreshInterval: number;
    reliability: number;
    bias: string;
    articleCount: number;
}

export const mockNewsSources: MockNewsSource[] = [
    { id: '1', name: 'Reuters', key: 'reuters', enabled: true, priority: 1, refreshInterval: 60, reliability: 0.95, bias: 'neutral', articleCount: 1250 },
    { id: '2', name: 'Bloomberg', key: 'bloomberg', enabled: true, priority: 2, refreshInterval: 60, reliability: 0.92, bias: 'neutral', articleCount: 980 },
    { id: '3', name: 'CNBC', key: 'cnbc', enabled: true, priority: 3, refreshInterval: 120, reliability: 0.85, bias: 'slight-bullish', articleCount: 756 },
    { id: '4', name: 'Yahoo Finance', key: 'yahoo', enabled: false, priority: 4, refreshInterval: 300, reliability: 0.78, bias: 'neutral', articleCount: 2100 },
    { id: '5', name: '鉅亨網', key: 'cnyes', enabled: true, priority: 5, refreshInterval: 180, reliability: 0.82, bias: 'neutral', articleCount: 890 },
    { id: '6', name: '經濟日報', key: 'udn', enabled: true, priority: 6, refreshInterval: 300, reliability: 0.80, bias: 'neutral', articleCount: 450 },
];

export const mockNewsAlerts: NewsAlertRule[] = [
    {
        id: '1', name: '重大財報警報', enabled: true,
        keywords: ['財報', '營收', '獲利'], symbols: ['AAPL', 'TSLA', 'NVDA'],
        minSeverity: 70, channels: { telegram: true, line: true, email: false },
        cooldownMinutes: 30, triggerCount: 15,
    },
    {
        id: '2', name: '監管政策追蹤', enabled: true,
        keywords: ['SEC', 'Fed', '升息', '降息'], symbols: [],
        minSeverity: 60, channels: { telegram: true, line: false, email: true },
        cooldownMinutes: 60, triggerCount: 8,
    },
    {
        id: '3', name: '加密貨幣新聞', enabled: false,
        keywords: ['Bitcoin', 'ETH', '加密貨幣'], symbols: ['BTC-USD', 'ETH-USD'],
        minSeverity: 50, channels: { telegram: true, line: false, email: false },
        cooldownMinutes: 15, triggerCount: 42,
    },
];
