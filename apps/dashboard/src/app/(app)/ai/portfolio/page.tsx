'use client';

import { useState, useEffect } from 'react';
import { useSimulation, type Position, type TradeRecord } from '@/lib/hooks/useSimulation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Activity,
    RefreshCw,
    RotateCcw,
    Send,
    ArrowUpCircle,
    ArrowDownCircle,
    DollarSign,
    PieChart,
    Trophy,
    AlertTriangle,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────

function formatCurrency(value: number, currency = 'NT$'): string {
    return `${currency}${value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
}

function formatPct(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

function formatDate(iso: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ── Page Component ─────────────────────────────────────────

export default function PortfolioPage() {
    const {
        portfolio,
        trades,
        isLoading,
        error,
        refreshPortfolio,
        refreshTrades,
        placeOrder,
        resetPortfolio,
    } = useSimulation();

    // Order form
    const [orderAction, setOrderAction] = useState<'BUY' | 'SELL'>('BUY');
    const [orderSymbol, setOrderSymbol] = useState('2330.TW');
    const [orderShares, setOrderShares] = useState('100');
    const [orderPrice, setOrderPrice] = useState('');
    const [orderSubmitting, setOrderSubmitting] = useState(false);

    // Load data on mount
    useEffect(() => {
        refreshPortfolio();
        refreshTrades();
    }, [refreshPortfolio, refreshTrades]);

    const handleOrder = async () => {
        if (orderSubmitting) return;
        setOrderSubmitting(true);
        await placeOrder(
            orderAction,
            orderSymbol,
            Number(orderShares),
            orderPrice ? Number(orderPrice) : undefined,
        );
        setOrderSubmitting(false);
    };

    const totalUnrealizedPnl = portfolio.positions.reduce(
        (sum, p) => sum + (p.unrealized_pnl || 0), 0
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Wallet className="h-6 w-6" />
                        虛擬投資組合
                    </h1>
                    <p className="text-muted-foreground">
                        模擬交易引擎 — 初始資金 NT$1,000,000
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { refreshPortfolio(); refreshTrades(); }}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                        重新整理
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={resetPortfolio}
                        disabled={isLoading}
                    >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        重置帳戶
                    </Button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {/* Portfolio Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            帳戶總值
                        </div>
                        <div className="text-2xl font-bold mt-1">
                            {formatCurrency(portfolio.total_value)}
                        </div>
                        <div className={`text-sm ${portfolio.daily_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            今日 {formatCurrency(portfolio.daily_pnl)} ({formatPct(portfolio.daily_pnl_pct)})
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Wallet className="h-4 w-4" />
                            可用現金
                        </div>
                        <div className="text-2xl font-bold mt-1">
                            {formatCurrency(portfolio.cash)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {((portfolio.cash / portfolio.total_value) * 100).toFixed(1)}% 現金比重
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <PieChart className="h-4 w-4" />
                            未實現損益
                        </div>
                        <div className={`text-2xl font-bold mt-1 ${totalUnrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(totalUnrealizedPnl)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {portfolio.positions.length} 檔持倉
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Trophy className="h-4 w-4" />
                            交易績效
                        </div>
                        <div className="text-2xl font-bold mt-1">
                            {portfolio.win_rate !== null ? `${portfolio.win_rate}%` : '-'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            勝率 · {portfolio.total_trades} 筆交易
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-4 text-center">
                        <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                        <div className="text-xl font-bold">
                            {portfolio.sharpe_ratio !== null ? portfolio.sharpe_ratio.toFixed(2) : '-'}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 text-center">
                        <div className="text-sm text-muted-foreground">最大回撤</div>
                        <div className={`text-xl font-bold ${portfolio.max_drawdown < -5 ? 'text-red-600' : ''}`}>
                            {portfolio.max_drawdown.toFixed(2)}%
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 text-center">
                        <div className="text-sm text-muted-foreground">勝 / 敗</div>
                        <div className="text-xl font-bold">
                            <span className="text-green-600">{portfolio.winning_trades}</span>
                            {' / '}
                            <span className="text-red-600">{portfolio.losing_trades}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="positions">
                <TabsList>
                    <TabsTrigger value="positions">
                        <BarChart3 className="h-4 w-4 mr-1" /> 持倉 ({portfolio.positions.length})
                    </TabsTrigger>
                    <TabsTrigger value="trades">
                        <Activity className="h-4 w-4 mr-1" /> 交易紀錄 ({trades.length})
                    </TabsTrigger>
                    <TabsTrigger value="order">
                        <Send className="h-4 w-4 mr-1" /> 模擬下單
                    </TabsTrigger>
                </TabsList>

                {/* Positions Tab */}
                <TabsContent value="positions">
                    <Card>
                        <CardContent className="pt-4">
                            {portfolio.positions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    目前無持倉 — 前往「模擬下單」開始交易
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-2">股票</th>
                                                <th className="text-right py-2">張數</th>
                                                <th className="text-right py-2">均價</th>
                                                <th className="text-right py-2">現價</th>
                                                <th className="text-right py-2">市值</th>
                                                <th className="text-right py-2">損益</th>
                                                <th className="text-right py-2">報酬率</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {portfolio.positions.map((pos: Position) => (
                                                <tr key={pos.symbol} className="border-b last:border-0">
                                                    <td className="py-2 font-medium">{pos.symbol}</td>
                                                    <td className="text-right py-2">{pos.shares}</td>
                                                    <td className="text-right py-2">{pos.avg_cost.toFixed(2)}</td>
                                                    <td className="text-right py-2">{pos.current_price.toFixed(2)}</td>
                                                    <td className="text-right py-2">{formatCurrency(pos.market_value)}</td>
                                                    <td className={`text-right py-2 ${pos.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatCurrency(pos.unrealized_pnl)}
                                                    </td>
                                                    <td className={`text-right py-2 ${pos.unrealized_pnl_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatPct(pos.unrealized_pnl_pct)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Trades Tab */}
                <TabsContent value="trades">
                    <Card>
                        <CardContent className="pt-4">
                            {trades.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    尚無交易紀錄
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-2">時間</th>
                                                <th className="text-left py-2">動作</th>
                                                <th className="text-left py-2">股票</th>
                                                <th className="text-right py-2">張數</th>
                                                <th className="text-right py-2">價格</th>
                                                <th className="text-right py-2">手續費</th>
                                                <th className="text-right py-2">損益</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {trades.map((trade: TradeRecord) => (
                                                <tr key={trade.trade_id} className="border-b last:border-0">
                                                    <td className="py-2 text-muted-foreground">
                                                        {formatDate(trade.executed_at)}
                                                    </td>
                                                    <td className="py-2">
                                                        <Badge variant={trade.action === 'BUY' ? 'default' : 'destructive'}>
                                                            {trade.action === 'BUY' ? (
                                                                <ArrowUpCircle className="h-3 w-3 mr-1" />
                                                            ) : (
                                                                <ArrowDownCircle className="h-3 w-3 mr-1" />
                                                            )}
                                                            {trade.action === 'BUY' ? '買入' : '賣出'}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-2 font-medium">{trade.symbol}</td>
                                                    <td className="text-right py-2">{trade.shares}</td>
                                                    <td className="text-right py-2">{trade.price.toFixed(2)}</td>
                                                    <td className="text-right py-2 text-muted-foreground">
                                                        {formatCurrency(trade.commission + trade.tax)}
                                                    </td>
                                                    <td className={`text-right py-2 font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {trade.pnl !== 0 ? formatCurrency(trade.pnl) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Order Tab */}
                <TabsContent value="order">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Send className="h-5 w-5" />
                                模擬下單
                            </CardTitle>
                            <CardDescription>
                                使用虛擬資金進行模擬交易 — 含手續費 0.1425% + 證交稅 0.3% + 滑點
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <Label>買賣方向</Label>
                                    <Select
                                        value={orderAction}
                                        onValueChange={(v) => setOrderAction(v as 'BUY' | 'SELL')}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="BUY">
                                                <span className="flex items-center gap-1">
                                                    <TrendingUp className="h-3 w-3" /> 買入
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="SELL">
                                                <span className="flex items-center gap-1">
                                                    <TrendingDown className="h-3 w-3" /> 賣出
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>股票代碼</Label>
                                    <Input
                                        value={orderSymbol}
                                        onChange={(e) => setOrderSymbol(e.target.value.toUpperCase())}
                                        placeholder="例: 2330.TW"
                                    />
                                </div>
                                <div>
                                    <Label>張數</Label>
                                    <Input
                                        type="number"
                                        value={orderShares}
                                        onChange={(e) => setOrderShares(e.target.value)}
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <Label>價格（留空自動取）</Label>
                                    <Input
                                        type="number"
                                        value={orderPrice}
                                        onChange={(e) => setOrderPrice(e.target.value)}
                                        placeholder="自動取得即時報價"
                                    />
                                </div>
                            </div>
                            <Button
                                className="mt-4 w-full"
                                onClick={handleOrder}
                                disabled={orderSubmitting || !orderSymbol || !orderShares}
                                variant={orderAction === 'BUY' ? 'default' : 'destructive'}
                            >
                                {orderSubmitting ? (
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : orderAction === 'BUY' ? (
                                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                                ) : (
                                    <ArrowDownCircle className="h-4 w-4 mr-2" />
                                )}
                                {orderAction === 'BUY' ? '模擬買入' : '模擬賣出'} {orderSymbol} × {orderShares}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
