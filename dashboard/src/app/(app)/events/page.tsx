'use client';

import { useEffect, useState, useMemo } from 'react';
import { getFusedEvents } from '@/lib/api/client';
import type { FusedEvent } from '@/lib/api/types';
import { DataTable, FilterBar, SeverityBadge, LoadingSkeleton, EmptyState } from '@/components/shared';
import type { Column } from '@/components/shared/DataTable';
import { formatTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { TrendingUp, Newspaper, MessageSquare, Zap, ExternalLink } from 'lucide-react';

export default function EventsPage() {
    const [events, setEvents] = useState<FusedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<FusedEvent | null>(null);

    // Filters
    const [searchKeyword, setSearchKeyword] = useState('');
    const [domainFilter, setDomainFilter] = useState('all');
    const [minSeverity, setMinSeverity] = useState('0');
    const [sortKey, setSortKey] = useState('ts');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        async function loadEvents() {
            try {
                const data = await getFusedEvents();
                setEvents(data);
            } catch (error) {
                console.error('Failed to load events:', error);
            } finally {
                setLoading(false);
            }
        }
        loadEvents();
    }, []);

    // Filtered and sorted events
    const filteredEvents = useMemo(() => {
        let result = [...events];

        // Keyword filter
        if (searchKeyword) {
            const keyword = searchKeyword.toLowerCase();
            result = result.filter(
                (e) =>
                    e.news_title.toLowerCase().includes(keyword) ||
                    e.symbol?.toLowerCase().includes(keyword) ||
                    e.impact_summary?.toLowerCase().includes(keyword)
            );
        }

        // Domain filter
        if (domainFilter !== 'all') {
            result = result.filter((e) => e.domain === domainFilter);
        }

        // Severity filter
        const minSev = parseInt(minSeverity, 10);
        if (minSev > 0) {
            result = result.filter((e) => e.severity >= minSev);
        }

        // Sorting
        result.sort((a, b) => {
            let comparison = 0;
            if (sortKey === 'severity') {
                comparison = a.severity - b.severity;
            } else if (sortKey === 'ts') {
                comparison = new Date(a.ts).getTime() - new Date(b.ts).getTime();
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [events, searchKeyword, domainFilter, minSeverity, sortKey, sortOrder]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('desc');
        }
    };

    // formatTime is now imported from @/lib/utils

    const getDomainBadge = (domain: string) => {
        const styles = {
            market: 'bg-green-500/20 text-green-500',
            news: 'bg-blue-500/20 text-blue-500',
            social: 'bg-purple-500/20 text-purple-500',
            fusion: 'bg-orange-500/20 text-orange-500',
        };
        const icons = {
            market: <TrendingUp className="h-3 w-3 mr-1" />,
            news: <Newspaper className="h-3 w-3 mr-1" />,
            social: <MessageSquare className="h-3 w-3 mr-1" />,
            fusion: <Zap className="h-3 w-3 mr-1" />,
        };
        return (
            <Badge className={styles[domain as keyof typeof styles] || ''} variant="outline">
                {icons[domain as keyof typeof icons]}
                {domain}
            </Badge>
        );
    };

    const columns: Column<FusedEvent>[] = [
        {
            key: 'ts',
            header: '時間',
            sortable: true,
            className: 'w-[120px]',
            render: (event) => (
                <span className="text-sm text-muted-foreground">{formatTime(event.ts)}</span>
            ),
        },
        {
            key: 'news_title',
            header: '標題',
            render: (event) => (
                <div className="max-w-md">
                    <p className="font-medium line-clamp-1">{event.news_title}</p>
                    {event.impact_summary && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{event.impact_summary}</p>
                    )}
                </div>
            ),
        },
        {
            key: 'severity',
            header: '嚴重度',
            sortable: true,
            className: 'w-[100px]',
            render: (event) => <SeverityBadge severity={event.severity} showLabel />,
        },
        {
            key: 'domain',
            header: '來源',
            className: 'w-[120px]',
            render: (event) => getDomainBadge(event.domain),
        },
        {
            key: 'symbol',
            header: '標的',
            className: 'w-[100px]',
            render: (event) =>
                event.symbol ? (
                    <Badge variant="outline">{event.symbol}</Badge>
                ) : (
                    <span className="text-muted-foreground">-</span>
                ),
        },
    ];

    const clearAllFilters = () => {
        setSearchKeyword('');
        setDomainFilter('all');
        setMinSeverity('0');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">融合事件</h1>
                    <p className="text-muted-foreground">市場、新聞、社群的跨域融合事件</p>
                </div>
                <LoadingSkeleton type="table" count={8} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">融合事件</h1>
                <p className="text-muted-foreground">市場、新聞、社群的跨域融合事件</p>
            </div>

            {/* Filters */}
            <FilterBar
                searchValue={searchKeyword}
                onSearchChange={setSearchKeyword}
                searchPlaceholder="搜尋標題、標的..."
                filters={[
                    {
                        id: 'domain',
                        label: '來源',
                        value: domainFilter,
                        onChange: setDomainFilter,
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'fusion', label: '融合' },
                            { value: 'market', label: '市場' },
                            { value: 'news', label: '新聞' },
                            { value: 'social', label: '社群' },
                        ],
                    },
                    {
                        id: 'severity',
                        label: '嚴重度',
                        value: minSeverity,
                        onChange: setMinSeverity,
                        options: [
                            { value: '0', label: '全部' },
                            { value: '80', label: '≥ 80 (危急)' },
                            { value: '60', label: '≥ 60 (高)' },
                            { value: '40', label: '≥ 40 (中)' },
                        ],
                    },
                ]}
                onClearAll={clearAllFilters}
            />

            {/* Events Table */}
            {filteredEvents.length === 0 ? (
                <EmptyState
                    title="沒有符合條件的事件"
                    description="嘗試調整篩選條件或清除所有篩選"
                />
            ) : (
                <DataTable
                    data={filteredEvents}
                    columns={columns}
                    sortKey={sortKey}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    onRowClick={setSelectedEvent}
                />
            )}

            {/* Event Detail Dialog */}
            <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <SeverityBadge severity={selectedEvent?.severity ?? 0} />
                            <span className="line-clamp-2">{selectedEvent?.news_title}</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedEvent && (
                        <div className="space-y-4">
                            {/* Meta info */}
                            <div className="flex flex-wrap gap-2">
                                {getDomainBadge(selectedEvent.domain)}
                                {selectedEvent.symbol && (
                                    <Badge variant="outline">{selectedEvent.symbol}</Badge>
                                )}
                                {selectedEvent.sentiment && (
                                    <Badge
                                        variant="outline"
                                        className={
                                            selectedEvent.sentiment === 'bullish'
                                                ? 'text-green-500'
                                                : selectedEvent.sentiment === 'bearish'
                                                    ? 'text-red-500'
                                                    : ''
                                        }
                                    >
                                        {selectedEvent.sentiment}
                                    </Badge>
                                )}
                                <span className="text-sm text-muted-foreground">
                                    {new Date(selectedEvent.ts).toLocaleString('zh-TW')}
                                </span>
                            </div>

                            {/* Impact Summary */}
                            {selectedEvent.impact_summary && (
                                <div>
                                    <h4 className="text-sm font-medium mb-1">影響摘要</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedEvent.impact_summary}
                                    </p>
                                </div>
                            )}

                            {/* Impact Hypothesis */}
                            {selectedEvent.impact_hypothesis && selectedEvent.impact_hypothesis.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium mb-1">影響推論</h4>
                                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                        {selectedEvent.impact_hypothesis.map((h, i) => (
                                            <li key={i}>{h}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Confidence */}
                            {selectedEvent.confidence && (
                                <div>
                                    <h4 className="text-sm font-medium mb-1">信心度</h4>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${selectedEvent.confidence * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium">
                                            {(selectedEvent.confidence * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Evidence */}
                            {selectedEvent.evidence && selectedEvent.evidence.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium mb-2">證據來源</h4>
                                    <div className="space-y-2">
                                        {selectedEvent.evidence.map((e, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                                            >
                                                <Badge variant="outline" className="flex-shrink-0">
                                                    {e.source}
                                                </Badge>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium line-clamp-1">{e.title}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(e.ts).toLocaleString('zh-TW')}
                                                    </p>
                                                </div>
                                                {e.url && (
                                                    <a
                                                        href={e.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-shrink-0 text-primary hover:underline"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
