'use client';

import { useState } from 'react';
import { useNewsSources } from '@/lib/hooks/useNewsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { LoadingSkeleton } from '@/components/shared';
import type { NewsSourceConfig } from '@/lib/news/types';
import {
    Globe,
    RefreshCw,
    Star,
    Plus,
    Settings,
    Clock,
    BarChart3,
} from 'lucide-react';

const sourceIcons: Record<string, string> = {
    reuters: '📰', bloomberg: '💹', wsj: '📊', cnbc: '📺',
    yahoo: '🔮', google: '🔍', local: '🏠', other: '📋',
};

// Mock data
const mockSources: NewsSourceConfig[] = [
    { id: '1', name: 'Reuters', source: 'reuters', url: 'https://reuters.com', reliability: 95, bias: 'center', enabled: true, priority: 'high', refreshInterval: 300, articleCount: 1250, lastFetchedAt: new Date().toISOString() },
    { id: '2', name: 'Bloomberg', source: 'bloomberg', url: 'https://bloomberg.com', reliability: 92, bias: 'center', enabled: true, priority: 'high', refreshInterval: 300, articleCount: 980, lastFetchedAt: new Date().toISOString() },
    { id: '3', name: 'Wall Street Journal', source: 'wsj', url: 'https://wsj.com', reliability: 88, bias: 'right', enabled: true, priority: 'medium', refreshInterval: 600, articleCount: 756, lastFetchedAt: new Date().toISOString() },
    { id: '4', name: 'CNBC', source: 'cnbc', url: 'https://cnbc.com', reliability: 82, bias: 'center', enabled: true, priority: 'medium', refreshInterval: 600, articleCount: 543, lastFetchedAt: new Date().toISOString() },
    { id: '5', name: 'Yahoo Finance', source: 'yahoo', url: 'https://finance.yahoo.com', reliability: 75, bias: 'center', enabled: false, priority: 'low', refreshInterval: 900, articleCount: 420, lastFetchedAt: new Date().toISOString() },
    { id: '6', name: 'Google News', source: 'google', url: 'https://news.google.com', reliability: 70, bias: 'unknown', enabled: true, priority: 'low', refreshInterval: 900, articleCount: 890, lastFetchedAt: new Date().toISOString() },
];

const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
};

const biasLabels: Record<string, string> = {
    left: '偏左', center: '中立', right: '偏右', unknown: '未知',
};

export default function NewsSourcesPage() {
    const { sources: apiSources, isLoading, refresh } = useNewsSources();
    const sources = apiSources.length > 0 ? apiSources : mockSources;

    const [localSources, setLocalSources] = useState<NewsSourceConfig[]>(sources);
    const [search, setSearch] = useState('');

    const handleToggle = (id: string) => {
        setLocalSources(prev => prev.map(s =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
        ));
    };

    const filteredSources = localSources.filter(s => {
        if (!search) return true;
        return s.name.toLowerCase().includes(search.toLowerCase());
    });

    const enabledCount = localSources.filter(s => s.enabled).length;
    const totalArticles = localSources.reduce((sum, s) => sum + s.articleCount, 0);

    const renderStars = (reliability: number) => {
        const stars = Math.round(reliability / 20);
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                    <Star
                        key={i}
                        className={`h-3 w-3 ${i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                    />
                ))}
                <span className="text-xs text-muted-foreground ml-1">{reliability}%</span>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">新聞來源管理</h1>
                <LoadingSkeleton type="card" count={4} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Globe className="h-6 w-6" />
                        新聞來源管理
                    </h1>
                    <p className="text-muted-foreground">
                        管理新聞抓取來源與可信度設定
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => refresh()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        刷新
                    </Button>
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        新增來源
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{localSources.length}</div>
                                <div className="text-sm text-muted-foreground">總來源數</div>
                            </div>
                            <Globe className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-green-600">{enabledCount}</div>
                                <div className="text-sm text-muted-foreground">已啟用</div>
                            </div>
                            <Settings className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{totalArticles.toLocaleString()}</div>
                                <div className="text-sm text-muted-foreground">總文章數</div>
                            </div>
                            <BarChart3 className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋來源..."
                className="max-w-md"
            />

            {/* Sources List */}
            <div className="grid gap-4 md:grid-cols-2">
                {filteredSources.map(source => (
                    <Card key={source.id} className={source.enabled ? '' : 'opacity-60'}>
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <div className="text-3xl">
                                    {sourceIcons[source.source] || '📰'}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold">{source.name}</h3>
                                        <Switch
                                            checked={source.enabled}
                                            onCheckedChange={() => handleToggle(source.id)}
                                        />
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">可信度:</span>
                                            {renderStars(source.reliability)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">立場:</span>
                                            <span>{biasLabels[source.bias || 'unknown']}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={priorityColors[source.priority]}>
                                                {source.priority === 'high' ? '高優先' : source.priority === 'medium' ? '中優先' : '低優先'}
                                            </Badge>
                                            <span className="text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                每 {source.refreshInterval / 60} 分鐘
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            {source.articleCount.toLocaleString()} 篇文章
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
