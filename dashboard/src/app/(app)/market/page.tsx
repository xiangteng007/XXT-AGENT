'use client';

import { useEffect, useState, useMemo } from 'react';
import { getMarketQuotes, getFusedEvents } from '@/lib/api/client';
import type { MarketQuote, FusedEvent } from '@/lib/api/types';
import { SeverityBadge, LoadingSkeleton, EmptyState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

export default function MarketPage() {
    const [quotes, setQuotes] = useState<MarketQuote[]>([]);
    const [events, setEvents] = useState<FusedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuote, setSelectedQuote] = useState<MarketQuote | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const [quotesData, eventsData] = await Promise.all([
                    getMarketQuotes(),
                    getFusedEvents(),
                ]);
                setQuotes(quotesData);
                setEvents(eventsData);
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Get events for a symbol
    const getSymbolEvents = (symbol: string) => {
        return events.filter((e) => e.symbol === symbol).slice(0, 5);
    };

    const formatPrice = (price: number) => {
        if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        if (price >= 100) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };

    const formatChange = (change: number, pct: number) => {
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
    };

    const formatTime = (ts: string) => {
        return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            stock: '股票',
            etf: 'ETF',
            crypto: '加密貨幣',
            future: '期貨',
            fx: '外匯',
        };
        return labels[type] || type;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">市場監控</h1>
                    <p className="text-muted-foreground">關注標的追蹤與異動偵測</p>
                </div>
                <LoadingSkeleton type="card" count={6} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">市場監控</h1>
                <p className="text-muted-foreground">關注標的追蹤與異動偵測</p>
            </div>

            {quotes.length === 0 ? (
                <EmptyState
                    title="沒有監控標的"
                    description="請先新增監控標的"
                    icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {quotes.map((quote) => (
                        <Card
                            key={quote.symbol}
                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setSelectedQuote(quote)}
                        >
                            <CardHeader className="flex flex-row items-start justify-between pb-2">
                                <div>
                                    <CardTitle className="text-lg">{quote.symbol}</CardTitle>
                                    <p className="text-sm text-muted-foreground">{quote.name}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {getTypeLabel(quote.type)}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between">
                                    <div>
                                        <div className="text-2xl font-bold">{formatPrice(quote.lastPrice)}</div>
                                        <div className={`flex items-center gap-1 text-sm ${quote.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {quote.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                            {formatChange(quote.change, quote.changePct)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">事件</span>
                                            <Badge variant={quote.eventCount > 0 ? 'default' : 'secondary'}>
                                                {quote.eventCount}
                                            </Badge>
                                        </div>
                                        {quote.lastEventSeverity && (
                                            <div className="mt-1">
                                                <SeverityBadge severity={quote.lastEventSeverity} size="sm" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <span>{selectedQuote?.symbol}</span>
                            <span className="text-muted-foreground font-normal">{selectedQuote?.name}</span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedQuote && (
                        <div className="space-y-6">
                            {/* Price Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm text-muted-foreground">現價</div>
                                    <div className="text-3xl font-bold">{formatPrice(selectedQuote.lastPrice)}</div>
                                    <div className={`flex items-center gap-1 ${selectedQuote.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {selectedQuote.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                        {formatChange(selectedQuote.change, selectedQuote.changePct)}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <div className="text-muted-foreground">最高</div>
                                        <div className="font-medium">{formatPrice(selectedQuote.high)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">最低</div>
                                        <div className="font-medium">{formatPrice(selectedQuote.low)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">成交量</div>
                                        <div className="font-medium">{selectedQuote.volume.toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">更新時間</div>
                                        <div className="font-medium">{formatTime(selectedQuote.updatedAt)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Events */}
                            <div>
                                <h4 className="text-sm font-medium mb-3">近期相關事件</h4>
                                {getSymbolEvents(selectedQuote.symbol).length === 0 ? (
                                    <p className="text-sm text-muted-foreground">暫無相關事件</p>
                                ) : (
                                    <div className="space-y-2">
                                        {getSymbolEvents(selectedQuote.symbol).map((event) => (
                                            <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                                <SeverityBadge severity={event.severity} size="sm" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium line-clamp-1">{event.news_title}</p>
                                                    {event.impact_summary && (
                                                        <p className="text-xs text-muted-foreground line-clamp-1">{event.impact_summary}</p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                                    {formatTime(event.ts)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
