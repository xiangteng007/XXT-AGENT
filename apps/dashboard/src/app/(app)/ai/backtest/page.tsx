'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LoadingSkeleton } from '@/components/shared';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Trophy,
    AlertTriangle,
    Activity,
    Zap,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

interface StrategyMetrics {
    strategy: string;
    total_return: number;
    annualized_return: number;
    annualized_volatility: number;
    sharpe_ratio: number;
    max_drawdown: number;
    trading_days_analyzed: number;
    total_trades: number;
    win_rate: number | null;
    transaction_costs: {
        total_commission: number;
        total_tax: number;
        total: number;
    };
    trades: Array<{
        action: string;
        date: string;
        price: number;
        shares: number;
        pnl?: number;
    }>;
    period: {
        start: string;
        end: string;
        start_price: number;
        end_price: number;
    };
}

interface ComparisonResult {
    symbol: string;
    status: string;
    strategies: Record<string, StrategyMetrics>;
    best_strategy: string;
}

// ── Strategy labels ────────────────────────────────────────

const strategyLabels: Record<string, { label: string; emoji: string; desc: string }> = {
    buy_and_hold: { label: '買入持有', emoji: '🏦', desc: '最基本的策略，買入後持有至結束' },
    sma_crossover: { label: 'SMA 交叉', emoji: '📊', desc: 'SMA 20/50 均線黃金/死亡交叉' },
    rsi_reversal: { label: 'RSI 反轉', emoji: '📉', desc: 'RSI 超賣買入 / 超買賣出' },
    breakout_volume: { label: '放量突破', emoji: '🚀', desc: '價格突破+成交量放大進場' },
};

// ── Helpers ────────────────────────────────────────────────

function formatPct(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
}

function formatCurrency(v: number): string {
    return `NT$${v.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
}

// ── Page ───────────────────────────────────────────────────

export default function BacktestPage() {
    const { getIdToken } = useAuth();
    const [symbol, setSymbol] = useState('NVDA');
    const [customSymbol, setCustomSymbol] = useState('');
    const [startDate, setStartDate] = useState('2023-01-01');
    const [endDate, setEndDate] = useState('2024-12-31');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ComparisonResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const runComparison = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const sym = customSymbol.trim() || symbol;

        try {
            const token = await getIdToken();
            const params = new URLSearchParams({ symbol: sym, start: startDate, end: endDate });
            const res = await fetch(`/api/market/backtest/compare?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                setError('回測比較失敗');
                setIsLoading(false);
                return;
            }

            const data = await res.json();
            if (data.error) {
                setError(data.error);
            } else {
                setResult(data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '連線失敗');
        }
        setIsLoading(false);
    }, [symbol, customSymbol, startDate, endDate, getIdToken]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-6 w-6" />
                    策略回測比較
                </h1>
                <p className="text-muted-foreground">
                    使用歷史數據比較多種交易策略的績效表現
                </p>
            </div>

            {/* Config */}
            <Card>
                <CardHeader>
                    <CardTitle>回測參數</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div>
                            <Label>股票代碼</Label>
                            <Select value={symbol} onValueChange={(v) => { setSymbol(v); setCustomSymbol(''); }}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NVDA">NVDA - NVIDIA</SelectItem>
                                    <SelectItem value="AAPL">AAPL - Apple</SelectItem>
                                    <SelectItem value="TSLA">TSLA - Tesla</SelectItem>
                                    <SelectItem value="2330.TW">2330.TW - 台積電</SelectItem>
                                    <SelectItem value="2317.TW">2317.TW - 鴻海</SelectItem>
                                    <SelectItem value="CUSTOM">自訂...</SelectItem>
                                </SelectContent>
                            </Select>
                            {symbol === 'CUSTOM' && (
                                <Input
                                    className="mt-2"
                                    value={customSymbol}
                                    onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                                    placeholder="例: MSFT"
                                />
                            )}
                        </div>
                        <div>
                            <Label>開始日期</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <Label>結束日期</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={runComparison} disabled={isLoading} className="w-full">
                                {isLoading ? (
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Zap className="h-4 w-4 mr-2" />
                                )}
                                執行比較
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {error}
                </div>
            )}

            {/* Loading */}
            {isLoading && <LoadingSkeleton type="card" count={2} />}

            {/* Results */}
            {result && !isLoading && (
                <>
                    {/* Best Strategy Banner */}
                    <Card className="border-green-500/50 bg-green-500/5">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <Trophy className="h-6 w-6 text-green-600" />
                                <div>
                                    <div className="font-bold text-lg">
                                        最佳策略: {strategyLabels[result.best_strategy]?.emoji}{' '}
                                        {strategyLabels[result.best_strategy]?.label || result.best_strategy}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {result.symbol} · {result.strategies[result.best_strategy]?.period?.start} 至{' '}
                                        {result.strategies[result.best_strategy]?.period?.end}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Strategy Comparison Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                策略績效比較
                            </CardTitle>
                            <CardDescription>
                                含交易成本（手續費 0.1425% + 證交稅 0.3% + 滑點 5bps）
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3">策略</th>
                                            <th className="text-right py-3">總報酬</th>
                                            <th className="text-right py-3">年化報酬</th>
                                            <th className="text-right py-3">年化波動</th>
                                            <th className="text-right py-3">Sharpe</th>
                                            <th className="text-right py-3">最大回撤</th>
                                            <th className="text-right py-3">交易次數</th>
                                            <th className="text-right py-3">勝率</th>
                                            <th className="text-right py-3">交易成本</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(result.strategies).map(([name, m]) => {
                                            if ('error' in m) return null;
                                            const isBest = name === result.best_strategy;
                                            return (
                                                <tr
                                                    key={name}
                                                    className={`border-b last:border-0 ${isBest ? 'bg-green-500/5' : ''}`}
                                                >
                                                    <td className="py-3">
                                                        <div className="flex items-center gap-2">
                                                            <span>{strategyLabels[name]?.emoji || '📈'}</span>
                                                            <span className="font-medium">{strategyLabels[name]?.label || name}</span>
                                                            {isBest && <Badge variant="default" className="text-xs">最佳</Badge>}
                                                        </div>
                                                    </td>
                                                    <td className={`text-right py-3 font-medium ${m.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatPct(m.total_return)}
                                                    </td>
                                                    <td className={`text-right py-3 ${m.annualized_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatPct(m.annualized_return)}
                                                    </td>
                                                    <td className="text-right py-3">{(m.annualized_volatility * 100).toFixed(2)}%</td>
                                                    <td className={`text-right py-3 font-medium ${m.sharpe_ratio >= 1 ? 'text-green-600' : m.sharpe_ratio < 0 ? 'text-red-600' : ''}`}>
                                                        {m.sharpe_ratio.toFixed(2)}
                                                    </td>
                                                    <td className="text-right py-3 text-red-600">
                                                        {(m.max_drawdown * 100).toFixed(2)}%
                                                    </td>
                                                    <td className="text-right py-3">{m.total_trades}</td>
                                                    <td className="text-right py-3">
                                                        {m.win_rate !== null ? `${m.win_rate}%` : '-'}
                                                    </td>
                                                    <td className="text-right py-3 text-muted-foreground">
                                                        {formatCurrency(m.transaction_costs?.total || 0)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Strategy Detail Cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {Object.entries(result.strategies).map(([name, m]) => {
                            if ('error' in m) return null;
                            const info = strategyLabels[name] || { label: name, emoji: '📈', desc: '' };
                            return (
                                <Card key={name}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            {info.emoji} {info.label}
                                            {name === result.best_strategy && (
                                                <Badge variant="default">
                                                    <Trophy className="h-3 w-3 mr-1" /> 最佳
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription>{info.desc}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <div className="text-muted-foreground">總報酬</div>
                                                <div className={`font-bold ${m.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {m.total_return >= 0 ? <TrendingUp className="h-3 w-3 inline mr-1" /> : <TrendingDown className="h-3 w-3 inline mr-1" />}
                                                    {formatPct(m.total_return)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Sharpe</div>
                                                <div className="font-bold">{m.sharpe_ratio.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">最大回撤</div>
                                                <div className="font-bold text-red-600">{(m.max_drawdown * 100).toFixed(2)}%</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">交易成本</div>
                                                <div className="font-bold">{formatCurrency(m.transaction_costs?.total || 0)}</div>
                                            </div>
                                        </div>

                                        {/* Recent trades */}
                                        {m.trades && m.trades.length > 0 && (
                                            <div className="mt-4 pt-3 border-t">
                                                <div className="text-xs text-muted-foreground mb-2">近期交易</div>
                                                <div className="space-y-1">
                                                    {m.trades.slice(-5).map((t, i) => (
                                                        <div key={i} className="flex justify-between text-xs">
                                                            <span>
                                                                <Badge variant={t.action.includes('BUY') ? 'default' : 'destructive'} className="text-xs mr-1">
                                                                    {t.action.includes('BUY') ? '買' : '賣'}
                                                                </Badge>
                                                                {t.date}
                                                            </span>
                                                            <span className={t.pnl !== undefined ? (t.pnl >= 0 ? 'text-green-600' : 'text-red-600') : ''}>
                                                                ${t.price.toFixed(2)} {t.pnl !== undefined ? `(${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)})` : ''}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
