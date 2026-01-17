// Mock data for events/timeline system
import type { NotificationChannels } from './news';

export type EventType = 'news' | 'social' | 'market' | 'alert';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface TimelineEvent {
    id: string;
    type: EventType;
    title: string;
    description: string;
    timestamp: string;
    severity: Severity;
    source: string;
    symbols?: string[];
    sentiment?: 'bullish' | 'bearish' | 'neutral';
    link?: string;
}

export const mockTimelineEvents: TimelineEvent[] = [
    { id: '1', type: 'news', title: 'NVDA 發布最新 AI 晶片', description: 'NVIDIA 宣布新一代 Blackwell 架構 GPU', timestamp: new Date(Date.now() - 300000).toISOString(), severity: 'high', source: 'Bloomberg', symbols: ['NVDA'], sentiment: 'bullish' },
    { id: '2', type: 'market', title: 'NVDA 股價突破 900', description: '受新品發布影響，盤中漲幅達 4.2%', timestamp: new Date(Date.now() - 600000).toISOString(), severity: 'high', source: 'Market', symbols: ['NVDA'], sentiment: 'bullish' },
    { id: '3', type: 'social', title: '@elonmusk 提及 AI', description: 'Elon Musk 在 X 上發文討論 AI 發展趨勢', timestamp: new Date(Date.now() - 900000).toISOString(), severity: 'medium', source: 'Twitter', symbols: ['TSLA'], sentiment: 'neutral' },
    { id: '4', type: 'alert', title: 'AAPL RSI 超買警報', description: 'RSI(14) 達到 72.5，進入超買區間', timestamp: new Date(Date.now() - 1200000).toISOString(), severity: 'medium', source: 'System', symbols: ['AAPL'], sentiment: 'bearish' },
    { id: '5', type: 'news', title: 'Fed 維持利率不變', description: '聯準會宣布維持基準利率在 5.25%-5.50%', timestamp: new Date(Date.now() - 1800000).toISOString(), severity: 'critical', source: 'Reuters', symbols: [], sentiment: 'neutral' },
];
