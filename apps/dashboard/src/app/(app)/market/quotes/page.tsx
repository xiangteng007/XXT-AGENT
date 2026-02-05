'use client';

import { useState, useMemo } from 'react';
import { useQuotes, useWatchlist, useMarketMutations } from '@/lib/hooks/useMarketData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton, AdvancedFilters, QuickFilters } from '@/components/shared';
import type { FilterConfig } from '@/components/shared/AdvancedFilters';
import type { Quote } from '@/lib/market/types';
import {
    Activity,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Star,
    Plus,
    Search,
    ArrowUpDown,
    BarChart2,
    DollarSign,
} from 'lucide-react';

const assetTypeOptions = [
    { value: 'stock', label: '股票' },
    { value: 'etf', label: 'ETF' },
    { value: 'crypto', label: '加密貨幣' },
    { value: 'future', label: '期貨' },
    { value: 'forex', label: '外匯' },
];

const exchangeOptions = [
    { value: 'NASDAQ', label: 'NASDAQ' },
    { value: 'NYSE', label: 'NYSE' },
    { value: 'Crypto', label: '加密貨幣' },
    { value: 'TWSE', label: '台灣證交所' },
];

const changeOptions = [
    { value: 'up', label: '上漲' },
    { value: 'down', label: '下跌' },
    { value: 'flat', label: '持平' },
];

const volumeOptions = [
    { value: 'high', label: '高成交量 (>1.2x)' },
    { value: 'normal', label: '正常成交量' },
    { value: 'low', label: '低成交量 (<0.8x)' },
];

const filterConfigs: FilterConfig[] = [
    { key: 'search', label: '搜尋標的', type: 'search', placeholder: '代號或名稱' },
    { key: 'types', label: '資產類型', type: 'multi-select', options: assetTypeOptions },
    { key: 'exchange', label: '交易所', type: 'select', options: exchangeOptions },
    { key: 'change', label: '漲跌方向', type: 'select', options: changeOptions },
    { key: 'volume', label: '成交量', type: 'select', options: volumeOptions },
];

const assetTypeLabels: Record<string, { label: string; color: string }> = {
    stock: { label: '股票', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    etf: { label: 'ETF', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    crypto: { label: '加密貨幣', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
    future: { label: '期貨', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    forex: { label: '外匯', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' },
};

// Mock symbols for demo
const defaultSymbols = ['AAPL', 'MSFT', 'GOOG', 'NVDA', 'TSLA', 'AMZN', 'META', 'BTC-USD', 'ETH-USD'];

// Mock quote data
const mockQuotes: Quote[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ', currency: 'USD', lastPrice: 185.92, previousClose: 183.58, open: 184.20, high: 186.50, low: 183.80, change: 2.34, changePct: 1.27, volume: 52000000, avgVolume: 48000000, volumeRatio: 1.08, high52w: 199.62, low52w: 140.00, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock', exchange: 'NASDAQ', currency: 'USD', lastPrice: 425.13, previousClose: 422.50, open: 423.00, high: 426.00, low: 421.80, change: 2.63, changePct: 0.62, volume: 18000000, avgVolume: 20000000, volumeRatio: 0.9, high52w: 430.82, low52w: 310.00, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
    { symbol: 'GOOG', name: 'Alphabet Inc.', type: 'stock', exchange: 'NASDAQ', currency: 'USD', lastPrice: 175.25, previousClose: 174.10, open: 174.50, high: 176.00, low: 173.80, change: 1.15, changePct: 0.66, volume: 15000000, avgVolume: 14000000, volumeRatio: 1.07, high52w: 180.00, low52w: 118.00, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', exchange: 'NASDAQ', currency: 'USD', lastPrice: 878.35, previousClose: 850.00, open: 855.00, high: 885.00, low: 852.00, change: 28.35, changePct: 3.34, volume: 42000000, avgVolume: 35000000, volumeRatio: 1.2, high52w: 974.00, low52w: 222.00, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', exchange: 'NASDAQ', currency: 'USD', lastPrice: 248.50, previousClose: 252.30, open: 251.00, high: 254.00, low: 246.00, change: -3.80, changePct: -1.51, volume: 68000000, avgVolume: 55000000, volumeRatio: 1.24, high52w: 299.29, low52w: 101.81, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', exchange: 'NASDAQ', currency: 'USD', lastPrice: 186.20, previousClose: 184.70, open: 185.00, high: 187.50, low: 184.20, change: 1.50, changePct: 0.81, volume: 28000000, avgVolume: 30000000, volumeRatio: 0.93, high52w: 191.70, low52w: 118.35, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
    { symbol: 'META', name: 'Meta Platforms Inc.', type: 'stock', exchange: 'NASDAQ', currency: 'USD', lastPrice: 505.80, previousClose: 508.20, open: 507.00, high: 510.00, low: 503.00, change: -2.40, changePct: -0.47, volume: 12000000, avgVolume: 13000000, volumeRatio: 0.92, high52w: 542.81, low52w: 274.38, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
    { symbol: 'BTC-USD', name: 'Bitcoin USD', type: 'crypto', exchange: 'Crypto', currency: 'USD', lastPrice: 96850.00, previousClose: 95200.00, open: 95500.00, high: 97500.00, low: 94800.00, change: 1650.00, changePct: 1.73, volume: 25000000000, avgVolume: 22000000000, volumeRatio: 1.14, high52w: 109000.00, low52w: 38500.00, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
    { symbol: 'ETH-USD', name: 'Ethereum USD', type: 'crypto', exchange: 'Crypto', currency: 'USD', lastPrice: 3420.50, previousClose: 3380.00, open: 3390.00, high: 3450.00, low: 3350.00, change: 40.50, changePct: 1.20, volume: 12000000000, avgVolume: 10000000000, volumeRatio: 1.2, high52w: 4090.00, low52w: 1520.00, lastTradeTime: new Date().toISOString(), marketStatus: 'open' },
];

type SortField = 'symbol' | 'lastPrice' | 'changePct' | 'volume';

export default function QuotesPage() {
    const { items: watchlistItems } = useWatchlist();
    const { addToWatchlist, isSubmitting } = useMarketMutations();

    const watchlistSymbols = useMemo(() => {
        return watchlistItems.map(item => item.symbol);
    }, [watchlistItems]);

    const { quotes: apiQuotes, isLoading, refresh } = useQuotes(defaultSymbols);

    const quotes = apiQuotes.length > 0 ? apiQuotes : mockQuotes;

    const [filters, setFilters] = useState<Record<string, string | string[]>>({});
    const [sortField, setSortField] = useState<SortField>('symbol');
    const [sortAsc, setSortAsc] = useState(true);

    const handleFilterChange = (key: string, value: string | string[]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilters({});
    };

    const getVolumeLevel = (quote: Quote): string => {
        if (quote.volumeRatio >= 1.2) return 'high';
        if (quote.volumeRatio <= 0.8) return 'low';
        return 'normal';
    };

    const filteredQuotes = useMemo(() => {
        let result = [...quotes];

        // Search filter
        const search = (filters.search as string)?.toLowerCase();
        if (search) {
            result = result.filter(q =>
                q.symbol.toLowerCase().includes(search) ||
                q.name.toLowerCase().includes(search)
            );
        }

        // Asset type filter
        const types = filters.types as string[];
        if (types?.length > 0) {
            result = result.filter(q => types.includes(q.type));
        }

        // Exchange filter
        const exchange = filters.exchange as string;
        if (exchange && exchange !== 'all') {
            result = result.filter(q => q.exchange === exchange);
        }

        // Change direction filter
        const change = filters.change as string;
        if (change && change !== 'all') {
            if (change === 'up') result = result.filter(q => q.change > 0);
            if (change === 'down') result = result.filter(q => q.change < 0);
            if (change === 'flat') result = result.filter(q => Math.abs(q.changePct) < 0.1);
        }

        // Volume filter
        const volumeFilter = filters.volume as string;
        if (volumeFilter && volumeFilter !== 'all') {
            result = result.filter(q => getVolumeLevel(q) === volumeFilter);
        }

        // Sorting
        result.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        });

        return result;
    }, [quotes, filters, sortField, sortAsc]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(field === 'symbol');
        }
    };

    const formatPrice = (price: number) => {
        if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
        if (price >= 100) return price.toFixed(2);
        return price.toFixed(4);
    };

    const formatVolume = (vol: number) => {
        if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
        if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
        if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
        return vol.toString();
    };

    const handleAddToWatchlist = async (symbol: string) => {
        await addToWatchlist(symbol);
    };

    // Stats
    const stats = useMemo(() => {
        const gainers = filteredQuotes.filter(q => q.changePct > 0).length;
        const losers = filteredQuotes.filter(q => q.changePct < 0).length;
        const avgChange = filteredQuotes.length > 0
            ? filteredQuotes.reduce((sum, q) => sum + q.changePct, 0) / filteredQuotes.length
            : 0;
        return { gainers, losers, avgChange };
    }, [filteredQuotes]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">即時報價</h1>
                <LoadingSkeleton type="table" count={8} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="h-6 w-6" />
                        即時報價
                    </h1>
                    <p className="text-muted-foreground">
                        {quotes.length} 檔標的 · 每 10 秒更新
                    </p>
                </div>
                <Button variant="outline" onClick={() => refresh()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    更新
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-3 md:grid-cols-4">
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <BarChart2 className="h-5 w-5 text-blue-500" />
                        <div>
                            <div className="text-xl font-bold">{filteredQuotes.length}</div>
                            <div className="text-xs text-muted-foreground">顯示標的</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        <div>
                            <div className="text-xl font-bold text-green-500">{stats.gainers}</div>
                            <div className="text-xs text-muted-foreground">上漲</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-500" />
                        <div>
                            <div className="text-xl font-bold text-red-500">{stats.losers}</div>
                            <div className="text-xs text-muted-foreground">下跌</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-yellow-500" />
                        <div>
                            <div className={`text-xl font-bold ${stats.avgChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
                            </div>
                            <div className="text-xs text-muted-foreground">平均漲跌</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Filters */}
            <QuickFilters
                options={assetTypeOptions}
                selected={(filters.quickType as string) || 'all'}
                onChange={(v) => {
                    if (v === 'all') {
                        setFilters(prev => ({ ...prev, types: [], quickType: 'all' }));
                    } else {
                        setFilters(prev => ({ ...prev, types: [v], quickType: v }));
                    }
                }}
            />

            {/* Advanced Filters */}
            <AdvancedFilters
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
                onClear={handleClearFilters}
                totalCount={quotes.length}
                filteredCount={filteredQuotes.length}
            />

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="text-left p-4 font-medium">
                                        <button
                                            className="flex items-center gap-1 hover:text-foreground"
                                            onClick={() => handleSort('symbol')}
                                            aria-label="依標的排序"
                                        >
                                            標的 <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </th>
                                    <th className="text-right p-4 font-medium">
                                        <button
                                            className="flex items-center gap-1 justify-end hover:text-foreground ml-auto"
                                            onClick={() => handleSort('lastPrice')}
                                            aria-label="依現價排序"
                                        >
                                            現價 <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </th>
                                    <th className="text-right p-4 font-medium">
                                        <button
                                            className="flex items-center gap-1 justify-end hover:text-foreground ml-auto"
                                            onClick={() => handleSort('changePct')}
                                            aria-label="依漲跌排序"
                                        >
                                            漲跌 <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </th>
                                    <th className="text-right p-4 font-medium">
                                        <button
                                            className="flex items-center gap-1 justify-end hover:text-foreground ml-auto"
                                            onClick={() => handleSort('volume')}
                                            aria-label="依成交量排序"
                                        >
                                            成交量 <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </th>
                                    <th className="text-right p-4 font-medium">最高/最低</th>
                                    <th className="w-24 p-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredQuotes.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                            沒有符合條件的標的
                                        </td>
                                    </tr>
                                ) : (
                                    filteredQuotes.map((quote) => {
                                        const isWatchlisted = watchlistSymbols.includes(quote.symbol);
                                        return (
                                            <tr key={quote.symbol} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <div className="font-semibold">{quote.symbol}</div>
                                                            <div className="text-sm text-muted-foreground">{quote.name}</div>
                                                        </div>
                                                        <Badge className={assetTypeLabels[quote.type]?.color || ''}>
                                                            {assetTypeLabels[quote.type]?.label || quote.type}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono text-lg font-semibold">
                                                    {formatPrice(quote.lastPrice)}
                                                </td>
                                                <td className={`p-4 text-right font-mono ${quote.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {quote.change >= 0 ? (
                                                            <TrendingUp className="h-4 w-4" />
                                                        ) : (
                                                            <TrendingDown className="h-4 w-4" />
                                                        )}
                                                        <div>
                                                            <div>{quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}</div>
                                                            <div className="text-sm">({quote.changePct >= 0 ? '+' : ''}{quote.changePct.toFixed(2)}%)</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div>{formatVolume(quote.volume)}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {quote.volumeRatio >= 1.1 && <span className="text-green-500">↑</span>}
                                                        {quote.volumeRatio <= 0.9 && <span className="text-red-500">↓</span>}
                                                        {quote.volumeRatio.toFixed(2)}x
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right text-sm">
                                                    <div className="text-green-600">{formatPrice(quote.high)}</div>
                                                    <div className="text-red-600">{formatPrice(quote.low)}</div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Button
                                                        variant={isWatchlisted ? "secondary" : "outline"}
                                                        size="sm"
                                                        onClick={() => handleAddToWatchlist(quote.symbol)}
                                                        disabled={isSubmitting || isWatchlisted}
                                                        aria-label={isWatchlisted ? '已在觀察清單' : '加入觀察清單'}
                                                    >
                                                        {isWatchlisted ? (
                                                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                        ) : (
                                                            <Plus className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
