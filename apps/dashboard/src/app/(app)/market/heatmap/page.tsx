'use client';

import { useMemo } from 'react';
import { useSectorHeatmap, useQuotes } from '@/lib/hooks/useMarketData';
import { useSectorStore } from '@/lib/market/sectorStore';
import { SectorManager } from '@/components/market/SectorManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared';
import chartStyles from '@/styles/charts.module.css';
import type { HeatmapCell } from '@/lib/market/types';
import {
    Grid3X3,
    RefreshCw,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';

const getHeatmapColor = (changePct: number): string => {
    if (changePct >= 5) return 'bg-green-600 text-white';
    if (changePct >= 3) return 'bg-green-500 text-white';
    if (changePct >= 1) return 'bg-green-400 text-white';
    if (changePct >= 0.5) return 'bg-green-300 text-green-900';
    if (changePct > -0.5) return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    if (changePct > -1) return 'bg-red-300 text-red-900';
    if (changePct > -3) return 'bg-red-400 text-white';
    if (changePct > -5) return 'bg-red-500 text-white';
    return 'bg-red-600 text-white';
};




export default function MarketHeatmapPage() {
    const { sectors: apiSectors, isLoading: apiLoading, refresh } = useSectorHeatmap();
    const {
        sectors: customSectors,
        isLoading: customLoading,
        addSector,
        editSector,
        removeSector,
        reset,
    } = useSectorStore();

    // Collect all unique symbols from custom sectors for real-time quotes
    const allSymbols = useMemo(
        () => Array.from(new Set(customSectors.flatMap(s => s.stocks.map(st => st.symbol)))),
        [customSectors]
    );
    const { quotes } = useQuotes(allSymbols);

    // Build quote lookup map for O(1) access
    const quoteMap = useMemo(() => {
        const map: Record<string, { changePct: number; volume: number; marketCap: number }> = {};
        quotes.forEach(q => {
            map[q.symbol] = {
                changePct: q.changePct ?? 0,
                volume: q.volume ?? 0,
                marketCap: q.marketCap ?? 1e11,
            };
        });
        return map;
    }, [quotes]);

    const isLoading = apiLoading || customLoading;

    // 合併 API 資料與自訂版塊結構
    const displaySectors = customSectors.map(sector => {
        // 使用即時報價數據
        const stocks = sector.stocks.map(stock => {
            const q = quoteMap[stock.symbol];
            return {
                symbol: stock.symbol,
                name: stock.name,
                sector: sector.id,
                industry: '',
                marketCap: q?.marketCap ?? 1e11,
                weight: 1 / sector.stocks.length,
                changePct: q?.changePct ?? 0,
                volume: q?.volume ?? 0,
                color: '',
            };
        });

        const avgChange = stocks.length > 0
            ? stocks.reduce((sum, s) => sum + s.changePct, 0) / stocks.length
            : 0;

        return {
            id: sector.id,
            name: sector.name,
            changePct: avgChange,
            marketCap: 1e12,
            volume: 1e9,
            stocks,
        };
    });

    const handleRefresh = () => {
        refresh();
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">市場熱力圖</h1>
                <LoadingSkeleton type="card" count={4} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Grid3X3 className="h-6 w-6" />
                        市場熱力圖
                    </h1>
                    <p className="text-muted-foreground">
                        產業與個股漲跌視覺化
                    </p>
                </div>
                <div className="flex gap-2">
                    <SectorManager
                        sectors={customSectors}
                        onAddSector={addSector}
                        onEditSector={editSector}
                        onDeleteSector={removeSector}
                        onReset={reset}
                    />
                    <Button variant="outline" onClick={handleRefresh}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        更新
                    </Button>
                </div>
            </div>

            {/* Legend */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-sm text-muted-foreground">跌</span>
                        <div className="flex h-6">
                            <div className="w-8 bg-red-600"></div>
                            <div className="w-8 bg-red-500"></div>
                            <div className="w-8 bg-red-400"></div>
                            <div className="w-8 bg-red-300"></div>
                            <div className="w-8 bg-gray-200 dark:bg-gray-700"></div>
                            <div className="w-8 bg-green-300"></div>
                            <div className="w-8 bg-green-400"></div>
                            <div className="w-8 bg-green-500"></div>
                            <div className="w-8 bg-green-600"></div>
                        </div>
                        <span className="text-sm text-muted-foreground">漲</span>
                    </div>
                </CardContent>
            </Card>

            {/* Sector Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                {displaySectors.map((sector) => (
                    <Card key={sector.id}>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between">
                                <span>{sector.name}</span>
                                <Badge
                                    variant="outline"
                                    className={sector.changePct >= 0 ? 'text-green-600' : 'text-red-600'}
                                >
                                    {sector.changePct >= 0 ? (
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                    ) : (
                                        <TrendingDown className="h-3 w-3 mr-1" />
                                    )}
                                    {sector.changePct >= 0 ? '+' : ''}{sector.changePct.toFixed(2)}%
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-1">
                                {sector.stocks.map((stock) => {
                                    const size = Math.max(60, Math.min(120, stock.weight * 400));
                                    return (
                                        <div
                                            key={stock.symbol}
                                            className={`${chartStyles.heatmapCell} p-2 rounded flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity ${getHeatmapColor(stock.changePct)}`}
                                            style={{
                                                '--cell-width': `${size}px`,
                                                '--cell-height': `${size * 0.7}px`,
                                            } as React.CSSProperties}
                                            title={`${stock.name}: ${stock.changePct >= 0 ? '+' : ''}${stock.changePct.toFixed(2)}%`}
                                        >
                                            <span className="font-bold text-sm">{stock.symbol}</span>
                                            <span className="text-xs opacity-90">
                                                {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(1)}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                            {displaySectors.filter(s => s.changePct > 0).length}
                        </div>
                        <div className="text-sm text-muted-foreground">上漲產業</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-red-600">
                            {displaySectors.filter(s => s.changePct < 0).length}
                        </div>
                        <div className="text-sm text-muted-foreground">下跌產業</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold">
                            {displaySectors.reduce((sum, s) => sum + s.stocks.length, 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">總標的數</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold">
                            {displaySectors.length > 0 ? (displaySectors.reduce((sum, s) => sum + s.changePct, 0) / displaySectors.length).toFixed(2) : '0.00'}%
                        </div>
                        <div className="text-sm text-muted-foreground">平均漲幅</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
