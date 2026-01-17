'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Clock,
    TrendingUp,
    TrendingDown,
    Newspaper,
    MessageCircle,
    BarChart3,
    AlertTriangle,
    CheckCircle,
    Filter,
    RefreshCw,
} from 'lucide-react';

type EventType = 'news' | 'social' | 'market' | 'alert';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface TimelineEvent {
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

// Mock data - cross-system events
const mockEvents: TimelineEvent[] = [
    { id: '1', type: 'news', title: 'NVDA 發布最新 AI 晶片', description: 'NVIDIA 宣布新一代 Blackwell 架構 GPU，效能提升 3 倍', timestamp: new Date(Date.now() - 300000).toISOString(), severity: 'high', source: 'Bloomberg', symbols: ['NVDA'], sentiment: 'bullish' },
    { id: '2', type: 'market', title: 'NVDA 股價突破 900', description: '受新品發布影響，盤中漲幅達 4.2%', timestamp: new Date(Date.now() - 600000).toISOString(), severity: 'high', source: 'Market', symbols: ['NVDA'], sentiment: 'bullish' },
    { id: '3', type: 'social', title: '@elonmusk 提及 AI', description: 'Elon Musk 在 X 上發文討論 AI 發展趨勢', timestamp: new Date(Date.now() - 900000).toISOString(), severity: 'medium', source: 'Twitter', symbols: ['TSLA'], sentiment: 'neutral' },
    { id: '4', type: 'alert', title: 'AAPL RSI 超買警報', description: 'RSI(14) 達到 72.5，進入超買區間', timestamp: new Date(Date.now() - 1200000).toISOString(), severity: 'medium', source: 'System', symbols: ['AAPL'], sentiment: 'bearish' },
    { id: '5', type: 'news', title: 'Fed 維持利率不變', description: '聯準會宣布維持基準利率在 5.25%-5.50%', timestamp: new Date(Date.now() - 1800000).toISOString(), severity: 'critical', source: 'Reuters', symbols: [], sentiment: 'neutral' },
    { id: '6', type: 'market', title: 'BTC 成交量異常', description: '24H 成交量較均量增加 180%', timestamp: new Date(Date.now() - 2400000).toISOString(), severity: 'high', source: 'Market', symbols: ['BTC-USD'], sentiment: 'bullish' },
    { id: '7', type: 'social', title: '加密貨幣社群熱議', description: '多個 KOL 同時發布看多觀點', timestamp: new Date(Date.now() - 3000000).toISOString(), severity: 'medium', source: 'Multiple', symbols: ['BTC-USD', 'ETH-USD'], sentiment: 'bullish' },
    { id: '8', type: 'alert', title: 'TSLA 跌破支撐位', description: '價格跌破 240 支撐位，觸發價格警報', timestamp: new Date(Date.now() - 3600000).toISOString(), severity: 'high', source: 'System', symbols: ['TSLA'], sentiment: 'bearish' },
];

const typeConfig: Record<EventType, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
    news: { icon: <Newspaper className="h-4 w-4" />, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900', label: '新聞' },
    social: { icon: <MessageCircle className="h-4 w-4" />, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900', label: '社群' },
    market: { icon: <BarChart3 className="h-4 w-4" />, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900', label: '市場' },
    alert: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900', label: '警報' },
};

const severityConfig: Record<Severity, { color: string; label: string }> = {
    low: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: '低' },
    medium: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: '中' },
    high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: '高' },
    critical: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: '緊急' },
};

const sentimentIcons: Record<string, { icon: React.ReactNode; color: string }> = {
    bullish: { icon: <TrendingUp className="h-4 w-4" />, color: 'text-green-500' },
    bearish: { icon: <TrendingDown className="h-4 w-4" />, color: 'text-red-500' },
    neutral: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-gray-400' },
};

export default function EventsTimelinePage() {
    const [events] = useState<TimelineEvent[]>(mockEvents);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [search, setSearch] = useState('');

    const filteredEvents = useMemo(() => {
        return events.filter(e => {
            if (typeFilter !== 'all' && e.type !== typeFilter) return false;
            if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
            if (search) {
                const s = search.toLowerCase();
                return e.title.toLowerCase().includes(s) ||
                    e.description.toLowerCase().includes(s) ||
                    e.symbols?.some(sym => sym.toLowerCase().includes(s));
            }
            return true;
        });
    }, [events, typeFilter, severityFilter, search]);

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return '剛剛';
        if (diffMins < 60) return `${diffMins} 分鐘前`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} 小時前`;
        return date.toLocaleDateString('zh-TW');
    };

    const groupedByHour = useMemo(() => {
        const groups: Record<string, TimelineEvent[]> = {};
        filteredEvents.forEach(e => {
            const hour = new Date(e.timestamp).toLocaleString('zh-TW', {
                month: '2-digit', day: '2-digit', hour: '2-digit',
            }) + ':00';
            if (!groups[hour]) groups[hour] = [];
            groups[hour].push(e);
        });
        return groups;
    }, [filteredEvents]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Clock className="h-6 w-6" />
                        全局時間軸
                    </h1>
                    <p className="text-muted-foreground">
                        整合新聞、社群、市場、警報的統一事件流
                    </p>
                </div>
                <Button variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜尋事件..."
                    className="max-w-xs"
                />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="類型" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部類型</SelectItem>
                        <SelectItem value="news">新聞</SelectItem>
                        <SelectItem value="social">社群</SelectItem>
                        <SelectItem value="market">市場</SelectItem>
                        <SelectItem value="alert">警報</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="嚴重度" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="critical">緊急</SelectItem>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-4">
                {(['news', 'social', 'market', 'alert'] as EventType[]).map(type => {
                    const config = typeConfig[type];
                    const count = events.filter(e => e.type === type).length;
                    return (
                        <Card
                            key={type}
                            className={`cursor-pointer transition-all ${typeFilter === type ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                        >
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-2xl font-bold">{count}</div>
                                        <div className="text-sm text-muted-foreground">{config.label}</div>
                                    </div>
                                    <div className={`p-2 rounded-full ${config.bg}`}>
                                        <span className={config.color}>{config.icon}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>

                <div className="space-y-6">
                    {Object.entries(groupedByHour).map(([hour, hourEvents]) => (
                        <div key={hour}>
                            {/* Time marker */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-3 h-3 rounded-full bg-primary z-10 ml-4"></div>
                                <span className="text-sm font-medium text-muted-foreground">{hour}</span>
                            </div>

                            {/* Events */}
                            <div className="space-y-3 ml-14">
                                {hourEvents.map(event => {
                                    const config = typeConfig[event.type];
                                    const sentiment = event.sentiment ? sentimentIcons[event.sentiment] : null;

                                    return (
                                        <Card key={event.id} className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg ${config.bg}`}>
                                                        <span className={config.color}>{config.icon}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <h4 className="font-medium">{event.title}</h4>
                                                            <Badge className={severityConfig[event.severity].color}>
                                                                {severityConfig[event.severity].label}
                                                            </Badge>
                                                            {sentiment && (
                                                                <span className={sentiment.color}>
                                                                    {sentiment.icon}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            {event.description}
                                                        </p>
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                            <span>{event.source}</span>
                                                            <span>{formatTime(event.timestamp)}</span>
                                                            {event.symbols && event.symbols.length > 0 && (
                                                                <div className="flex gap-1">
                                                                    {event.symbols.map(s => (
                                                                        <Badge key={s} variant="secondary" className="text-xs">
                                                                            {s}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {filteredEvents.length === 0 && (
                <div className="text-center py-12">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">沒有符合條件的事件</p>
                </div>
            )}
        </div>
    );
}
