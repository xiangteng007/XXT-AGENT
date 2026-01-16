'use client';

import { useEffect, useState, useMemo } from 'react';
import { getNewsItems } from '@/lib/api/client';
import type { NewsItem } from '@/lib/api/types';
import { DataTable, FilterBar, SeverityBadge, LoadingSkeleton, EmptyState } from '@/components/shared';
import type { Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, Newspaper } from 'lucide-react';

export default function NewsPage() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

    // Filters
    const [searchKeyword, setSearchKeyword] = useState('');
    const [topicFilter, setTopicFilter] = useState('all');
    const [timeRange, setTimeRange] = useState('24h');

    useEffect(() => {
        async function loadNews() {
            try {
                const data = await getNewsItems();
                setNews(data);
            } catch (error) {
                console.error('Failed to load news:', error);
            } finally {
                setLoading(false);
            }
        }
        loadNews();
    }, []);

    // Get unique topics
    const topics = useMemo(() => {
        const topicSet = new Set(news.map((n) => n.topic));
        return Array.from(topicSet);
    }, [news]);

    // Filtered news
    const filteredNews = useMemo(() => {
        let result = [...news];

        if (searchKeyword) {
            const kw = searchKeyword.toLowerCase();
            result = result.filter(
                (n) => n.title.toLowerCase().includes(kw) || n.summary.toLowerCase().includes(kw)
            );
        }

        if (topicFilter !== 'all') {
            result = result.filter((n) => n.topic === topicFilter);
        }

        return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [news, searchKeyword, topicFilter]);

    const formatTime = (ts: string) => {
        const date = new Date(ts);
        return date.toLocaleString('zh-TW', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        });
    };

    const columns: Column<NewsItem>[] = [
        {
            key: 'source',
            header: '來源',
            className: 'w-[120px]',
            render: (item) => (
                <span className="text-sm font-medium">{item.source}</span>
            ),
        },
        {
            key: 'title',
            header: '標題',
            render: (item) => (
                <div className="max-w-lg">
                    <p className="font-medium line-clamp-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.summary}</p>
                </div>
            ),
        },
        {
            key: 'topic',
            header: '主題',
            className: 'w-[100px]',
            render: (item) => <Badge variant="outline">{item.topic}</Badge>,
        },
        {
            key: 'symbols',
            header: '標的',
            className: 'w-[150px]',
            render: (item) => (
                <div className="flex flex-wrap gap-1">
                    {item.symbols.slice(0, 2).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                    {item.symbols.length > 2 && (
                        <Badge variant="secondary" className="text-xs">+{item.symbols.length - 2}</Badge>
                    )}
                </div>
            ),
        },
        {
            key: 'severity',
            header: '嚴重度',
            className: 'w-[80px]',
            render: (item) => item.severity ? <SeverityBadge severity={item.severity} /> : <span className="text-muted-foreground">-</span>,
        },
        {
            key: 'timestamp',
            header: '時間',
            className: 'w-[100px]',
            render: (item) => <span className="text-xs text-muted-foreground">{formatTime(item.timestamp)}</span>,
        },
    ];

    const clearAllFilters = () => {
        setSearchKeyword('');
        setTopicFilter('all');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">新聞監控</h1>
                    <p className="text-muted-foreground">財經新聞即時追蹤</p>
                </div>
                <LoadingSkeleton type="table" count={6} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">新聞監控</h1>
                <p className="text-muted-foreground">財經新聞即時追蹤</p>
            </div>

            <FilterBar
                searchValue={searchKeyword}
                onSearchChange={setSearchKeyword}
                searchPlaceholder="搜尋標題或摘要..."
                filters={[
                    {
                        id: 'topic', label: '主題', value: topicFilter, onChange: setTopicFilter,
                        options: [
                            { value: 'all', label: '全部' },
                            ...topics.map((t) => ({ value: t, label: t })),
                        ],
                    },
                    {
                        id: 'time', label: '時間', value: timeRange, onChange: setTimeRange,
                        options: [
                            { value: '30m', label: '近30分鐘' },
                            { value: '2h', label: '近2小時' },
                            { value: '24h', label: '近24小時' },
                            { value: '7d', label: '近7天' },
                        ],
                    },
                ]}
                onClearAll={clearAllFilters}
            />

            {filteredNews.length === 0 ? (
                <EmptyState
                    title="沒有符合條件的新聞"
                    description="嘗試調整篩選條件"
                    icon={<Newspaper className="h-8 w-8 text-muted-foreground" />}
                />
            ) : (
                <DataTable data={filteredNews} columns={columns} onRowClick={setSelectedNews} />
            )}

            <Dialog open={!!selectedNews} onOpenChange={() => setSelectedNews(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="line-clamp-2">{selectedNews?.title}</DialogTitle>
                    </DialogHeader>
                    {selectedNews && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge>{selectedNews.source}</Badge>
                                <Badge variant="outline">{selectedNews.topic}</Badge>
                                {selectedNews.severity && <SeverityBadge severity={selectedNews.severity} showLabel />}
                                {selectedNews.sentiment && (
                                    <Badge variant="outline" className={
                                        selectedNews.sentiment === 'bullish' ? 'text-green-500' :
                                            selectedNews.sentiment === 'bearish' ? 'text-red-500' : ''
                                    }>
                                        {selectedNews.sentiment}
                                    </Badge>
                                )}
                            </div>

                            <div>
                                <h4 className="text-sm font-medium mb-1">摘要</h4>
                                <p className="text-sm text-muted-foreground">{selectedNews.summary}</p>
                            </div>

                            <div>
                                <h4 className="text-sm font-medium mb-2">相關標的</h4>
                                <div className="flex flex-wrap gap-2">
                                    {selectedNews.symbols.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                                </div>
                            </div>

                            {selectedNews.impactHint && (
                                <div>
                                    <h4 className="text-sm font-medium mb-1">影響提示</h4>
                                    <p className="text-sm text-muted-foreground">{selectedNews.impactHint}</p>
                                </div>
                            )}

                            <div className="pt-2 border-t">
                                <a
                                    href={selectedNews.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                    查看原文 <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
