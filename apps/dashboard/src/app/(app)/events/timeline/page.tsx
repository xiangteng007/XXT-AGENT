'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
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
    Loader2,
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

// Domain mapping: fused_events.domain → EventType
const DOMAIN_TO_TYPE: Record<string, EventType> = {
    news: 'news',
    social: 'social',
    market: 'market',
    alert: 'alert',
    finance: 'market',
    regulation: 'news',
    system: 'alert',
};

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
    const { getIdToken } = useAuth();
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [search, setSearch] = useState('');

    const fetchEvents = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/admin/fused-events?limit=50', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const mapped: TimelineEvent[] = (data.events || []).map((e: Record<string, unknown>) => ({
                    id: e.id as string,
                    type: DOMAIN_TO_TYPE[(e.domain as string) || ''] || 'alert',
                    title: (e.title as string) || (e.headline as string) || '事件',
                    description: (e.summary as string) || (e.description as string) || '',
                    timestamp: (e.ts as string) || new Date().toISOString(),
                    severity: (e.severity as Severity) || 'medium',
                    source: (e.source as string) || (e.domain as string) || 'System',
                    symbols: (e.symbols as string[]) || [],
                    sentiment: (e.sentiment as TimelineEvent['sentiment']) || 'neutral',
                    link: e.link as string | undefined,
                }));
                setEvents(mapped);
            }
        } catch (err) {
            console.error('Failed to fetch events:', err);
        }
        setIsLoading(false);
    }, [getIdToken]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

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
                <Button variant="outline" onClick={fetchEvents} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
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
