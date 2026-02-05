'use client';

import { useState } from 'react';
import { useTechnicalIndicators } from '@/lib/hooks/useMarketData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton } from '@/components/shared';
import type { TechnicalIndicators } from '@/lib/market/types';
import {
    Activity,
    TrendingUp,
    TrendingDown,
    Minus,
    RefreshCw,
    Search,
    AlertTriangle,
    CheckCircle,
} from 'lucide-react';

// Mock data
const mockIndicators: Record<string, TechnicalIndicators> = {
    'AAPL': {
        symbol: 'AAPL', timestamp: new Date().toISOString(),
        sma20: 182.50, sma50: 178.30, sma200: 170.20,
        ema12: 184.10, ema26: 181.50,
        rsi14: 58.5,
        macd: { macd: 2.60, signal: 2.10, histogram: 0.50 },
        stochastic: { k: 65.2, d: 60.8 },
        bollingerBands: { upper: 192.50, middle: 182.50, lower: 172.50 },
        atr14: 3.25,
        vwap: 185.20, obv: 125000000,
        adx: 28.5, trend: 'up',
        support: [180.00, 175.00, 170.00], resistance: [190.00, 195.00, 200.00],
    },
    'NVDA': {
        symbol: 'NVDA', timestamp: new Date().toISOString(),
        sma20: 850.00, sma50: 820.00, sma200: 650.00,
        ema12: 865.00, ema26: 840.00,
        rsi14: 72.3,
        macd: { macd: 25.00, signal: 18.00, histogram: 7.00 },
        stochastic: { k: 82.5, d: 78.2 },
        bollingerBands: { upper: 920.00, middle: 850.00, lower: 780.00 },
        atr14: 22.50,
        vwap: 875.00, obv: 350000000,
        adx: 42.5, trend: 'up',
        support: [840.00, 800.00, 750.00], resistance: [900.00, 950.00, 1000.00],
    },
    'TSLA': {
        symbol: 'TSLA', timestamp: new Date().toISOString(),
        sma20: 255.00, sma50: 260.00, sma200: 230.00,
        ema12: 250.00, ema26: 258.00,
        rsi14: 42.1,
        macd: { macd: -8.00, signal: -5.00, histogram: -3.00 },
        stochastic: { k: 35.5, d: 40.2 },
        bollingerBands: { upper: 280.00, middle: 255.00, lower: 230.00 },
        atr14: 8.50,
        vwap: 248.50, obv: 280000000,
        adx: 22.0, trend: 'down',
        support: [240.00, 220.00, 200.00], resistance: [260.00, 280.00, 300.00],
    },
};

const defaultSymbols = ['AAPL', 'NVDA', 'TSLA', 'META', 'GOOG'];

export default function MarketIndicatorsPage() {
    const [symbols] = useState(defaultSymbols);
    const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
    const [searchSymbol, setSearchSymbol] = useState('');

    const { indicators: apiIndicators, isLoading } = useTechnicalIndicators(selectedSymbol);
    const indicators = apiIndicators || mockIndicators[selectedSymbol];

    const handleSearch = () => {
        if (searchSymbol) {
            setSelectedSymbol(searchSymbol.toUpperCase());
        }
    };

    const getRSIStatus = (rsi: number) => {
        if (rsi >= 70) return { label: '超買', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900' };
        if (rsi <= 30) return { label: '超賣', color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900' };
        return { label: '中性', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' };
    };

    const getTrendIcon = (trend: string) => {
        if (trend === 'up') return <TrendingUp className="h-5 w-5 text-green-500" />;
        if (trend === 'down') return <TrendingDown className="h-5 w-5 text-red-500" />;
        return <Minus className="h-5 w-5 text-gray-400" />;
    };

    const formatPrice = (price: number) => {
        return price >= 100 ? price.toFixed(2) : price.toFixed(4);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">技術指標</h1>
                <LoadingSkeleton type="card" count={4} />
            </div>
        );
    }

    const rsiStatus = indicators ? getRSIStatus(indicators.rsi14) : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="h-6 w-6" />
                        技術指標
                    </h1>
                    <p className="text-muted-foreground">
                        即時技術分析與趨勢判斷
                    </p>
                </div>
            </div>

            {/* Symbol Selector */}
            <div className="flex gap-4 items-center">
                <div className="flex gap-2">
                    {symbols.map(sym => (
                        <Button
                            key={sym}
                            variant={selectedSymbol === sym ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedSymbol(sym)}
                        >
                            {sym}
                        </Button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Input
                        value={searchSymbol}
                        onChange={(e) => setSearchSymbol(e.target.value)}
                        placeholder="輸入代號..."
                        className="w-32"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button variant="outline" size="icon" onClick={handleSearch}>
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {indicators && (
                <>
                    {/* Overview */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-muted-foreground">趨勢</div>
                                        <div className="text-2xl font-bold flex items-center gap-2">
                                            {getTrendIcon(indicators.trend)}
                                            {indicators.trend === 'up' ? '上升' : indicators.trend === 'down' ? '下降' : '盤整'}
                                        </div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <div className="text-muted-foreground">ADX</div>
                                        <div className="font-medium">{indicators.adx.toFixed(1)}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={rsiStatus?.bg}>
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-muted-foreground">RSI (14)</div>
                                        <div className={`text-2xl font-bold ${rsiStatus?.color}`}>
                                            {indicators.rsi14.toFixed(1)}
                                        </div>
                                    </div>
                                    <Badge className={rsiStatus?.bg}>
                                        {rsiStatus?.label}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-sm text-muted-foreground mb-1">MACD</div>
                                <div className="flex items-center gap-2">
                                    {indicators.macd.histogram > 0 ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                    )}
                                    <span className={indicators.macd.histogram > 0 ? 'text-green-600' : 'text-red-600'}>
                                        {indicators.macd.histogram > 0 ? '看多' : '看空'}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    MACD: {indicators.macd.macd.toFixed(2)} | Signal: {indicators.macd.signal.toFixed(2)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-sm text-muted-foreground mb-1">ATR (14)</div>
                                <div className="text-2xl font-bold">{indicators.atr14.toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground">波動度指標</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Moving Averages */}
                    <Card>
                        <CardHeader>
                            <CardTitle>移動平均線</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-3">
                                    <h4 className="font-medium text-sm">簡單移動平均 (SMA)</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">SMA 20</span>
                                            <span className="font-mono">{formatPrice(indicators.sma20)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">SMA 50</span>
                                            <span className="font-mono">{formatPrice(indicators.sma50)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">SMA 200</span>
                                            <span className="font-mono">{formatPrice(indicators.sma200)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="font-medium text-sm">指數移動平均 (EMA)</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">EMA 12</span>
                                            <span className="font-mono">{formatPrice(indicators.ema12)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">EMA 26</span>
                                            <span className="font-mono">{formatPrice(indicators.ema26)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="font-medium text-sm">布林通道</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">上軌</span>
                                            <span className="font-mono text-red-500">{formatPrice(indicators.bollingerBands.upper)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">中軌</span>
                                            <span className="font-mono">{formatPrice(indicators.bollingerBands.middle)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">下軌</span>
                                            <span className="font-mono text-green-500">{formatPrice(indicators.bollingerBands.lower)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Support & Resistance */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-green-600 flex items-center gap-2">
                                    <TrendingDown className="h-5 w-5" />
                                    支撐位
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {indicators.support.map((price, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-2 rounded bg-green-50 dark:bg-green-950">
                                            <span className="text-sm">S{idx + 1}</span>
                                            <span className="font-mono font-medium">{formatPrice(price)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-red-600 flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5" />
                                    阻力位
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {indicators.resistance.map((price, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-2 rounded bg-red-50 dark:bg-red-950">
                                            <span className="text-sm">R{idx + 1}</span>
                                            <span className="font-mono font-medium">{formatPrice(price)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Volume Indicators */}
                    <Card>
                        <CardHeader>
                            <CardTitle>成交量指標</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">VWAP</span>
                                    <span className="font-mono font-medium">{formatPrice(indicators.vwap)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">OBV</span>
                                    <span className="font-mono font-medium">{(indicators.obv / 1e6).toFixed(1)}M</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {!indicators && (
                <div className="text-center py-12">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">無法載入 {selectedSymbol} 的技術指標</p>
                </div>
            )}
        </div>
    );
}
