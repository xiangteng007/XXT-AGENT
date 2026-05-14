'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { exportCSV } from '@/lib/export';
import { usePortfolios, usePortfolio } from '@/lib/hooks/usePortfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LoadingSkeleton, EmptyState } from '@/components/shared';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    PieChart,
    BarChart3,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
    Settings,
    Trash2,
    Edit,
    X,
    Save,
    Briefcase,
    Target,
    Shield,
    Activity,
    Download,
} from 'lucide-react';

// Portfolio types
interface Portfolio {
    id: string;
    name: string;
    description?: string;
    currency: string;
    benchmark?: string;
    isDefault: boolean;
    createdAt: string;
    totalValue: number;
    totalCost: number;
    totalPnL: number;
    totalPnLPct: number;
    dailyPnL: number;
    dailyPnLPct: number;
    cashBalance: number;
    positions: Position[];
    riskMetrics: RiskMetrics;
}

interface Position {
    id: string;
    symbol: string;
    name: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPct: number;
    weight: number;
}

interface RiskMetrics {
    sharpeRatio: number;
    annualizedVolatility: number;
    maxDrawdown: number;
    beta: number;
    var95: number;
    top5Weight: number;
}

export default function PortfolioPage() {
    const { getIdToken } = useAuth();
    const { portfolios: apiPortfolios, isLoading: hookLoading, mutate: refreshPortfolios } = usePortfolios();
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showAddPosition, setShowAddPosition] = useState(false);
    const [editingPortfolio, setEditingPortfolio] = useState<string | null>(null);

    // Create portfolio form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formCurrency, setFormCurrency] = useState('TWD');
    const [formBenchmark, setFormBenchmark] = useState('');
    const [formCash, setFormCash] = useState('');

    // Add position form state
    const [posSymbol, setPosSymbol] = useState('');
    const [posName, setPosName] = useState('');
    const [posQuantity, setPosQuantity] = useState('');
    const [posCost, setPosCost] = useState('');

    // Sync hook data into local state
    useEffect(() => {
        if (apiPortfolios && apiPortfolios.length > 0) {
            setPortfolios(apiPortfolios as unknown as Portfolio[]);
            if (!selectedId || !(apiPortfolios as unknown as Portfolio[]).find(m => m.id === selectedId)) {
                setSelectedId((apiPortfolios as unknown as Portfolio[])[0].id);
            }
        }
    }, [apiPortfolios]);

    if (hookLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">投資組合管理</h1>
                <LoadingSkeleton type="card" count={4} />
            </div>
        );
    }

    const activePortfolio = portfolios.find(p => p.id === selectedId) || portfolios[0];

    const formatCurrency = (value: number, currency: string = 'TWD') => {
        return new Intl.NumberFormat('zh-TW', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatPct = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    const handleCreatePortfolio = async () => {
        try {
            const token = await getIdToken();
            const res = await fetch('/api/portfolios', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formName,
                    description: formDescription,
                    currency: formCurrency,
                    benchmark: formBenchmark,
                    cashBalance: parseFloat(formCash) || 0,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setSelectedId(data.portfolio.id);
                refreshPortfolios(); // Re-fetch from server
            }
        } catch (err) {
            console.error('Failed to create portfolio:', err);
        }
        resetCreateForm();
    };

    const handleAddPosition = () => {
        if (!activePortfolio) return;
        const quantity = parseFloat(posQuantity);
        const cost = parseFloat(posCost);
        const currentPrice = cost * (1 + (Math.random() - 0.3) * 0.2); // Simulate current price

        const newPosition: Position = {
            id: Date.now().toString(),
            symbol: posSymbol.toUpperCase(),
            name: posName,
            quantity,
            avgCost: cost,
            currentPrice,
            marketValue: quantity * currentPrice,
            unrealizedPnL: quantity * (currentPrice - cost),
            unrealizedPnLPct: ((currentPrice - cost) / cost) * 100,
            weight: 0, // Will be recalculated
        };

        setPortfolios(prev => prev.map(p => {
            if (p.id !== activePortfolio.id) return p;
            const updatedPositions = [...p.positions, newPosition];
            const totalValue = updatedPositions.reduce((sum, pos) => sum + pos.marketValue, 0) + p.cashBalance;
            return {
                ...p,
                positions: updatedPositions.map(pos => ({ ...pos, weight: (pos.marketValue / totalValue) * 100 })),
                totalValue,
                totalCost: p.totalCost + quantity * cost,
                totalPnL: totalValue - (p.totalCost + quantity * cost),
                totalPnLPct: ((totalValue - (p.totalCost + quantity * cost)) / (p.totalCost + quantity * cost)) * 100,
            };
        }));
        resetAddPositionForm();
    };

    const handleDeletePortfolio = async (id: string) => {
        if (portfolios.length <= 1) return;
        try {
            const token = await getIdToken();
            await fetch(`/api/portfolio/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            refreshPortfolios();
            if (selectedId === id) {
                setSelectedId(portfolios.find(p => p.id !== id)?.id || '');
            }
        } catch (err) {
            console.error('Failed to delete portfolio:', err);
        }
    };

    const resetCreateForm = () => {
        setShowCreateForm(false);
        setFormName('');
        setFormDescription('');
        setFormCurrency('TWD');
        setFormBenchmark('');
        setFormCash('');
    };

    const resetAddPositionForm = () => {
        setShowAddPosition(false);
        setPosSymbol('');
        setPosName('');
        setPosQuantity('');
        setPosCost('');
    };

    const totalAssets = portfolios.reduce((sum, p) => sum + p.totalValue, 0);
    const totalPnL = portfolios.reduce((sum, p) => sum + p.totalPnL, 0);
    const totalDailyPnL = portfolios.reduce((sum, p) => sum + p.dailyPnL, 0);

    const pnlColor = activePortfolio?.totalPnL >= 0 ? 'text-green-500' : 'text-red-500';
    const dailyPnlColor = activePortfolio?.dailyPnL >= 0 ? 'text-green-500' : 'text-red-500';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20">
                            <Briefcase className="h-6 w-6 text-gold" />
                        </div>
                        投資組合管理
                    </h1>
                    <p className="text-muted-foreground">
                        管理 {portfolios.length} 個投資組合 · 總資產 {formatCurrency(totalAssets)}
                    </p>
                </div>
                <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    新增組合
                </Button>
            </div>

            {/* Create Portfolio Form */}
            {showCreateForm && (
                <Card className="border-primary">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>建立新投資組合</span>
                            <Button variant="ghost" size="icon" onClick={resetCreateForm}>
                                <X className="h-4 w-4" />
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="portfolio-name">組合名稱 *</Label>
                                <Input
                                    id="portfolio-name"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="例：台股價值投資"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="portfolio-desc">描述</Label>
                                <Input
                                    id="portfolio-desc"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="投資策略說明"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="portfolio-currency">幣別</Label>
                                <Select value={formCurrency} onValueChange={setFormCurrency}>
                                    <SelectTrigger id="portfolio-currency">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TWD">TWD 新台幣</SelectItem>
                                        <SelectItem value="USD">USD 美元</SelectItem>
                                        <SelectItem value="JPY">JPY 日圓</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="portfolio-benchmark">基準指數</Label>
                                <Select value={formBenchmark} onValueChange={setFormBenchmark}>
                                    <SelectTrigger id="portfolio-benchmark">
                                        <SelectValue placeholder="選擇基準" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TAIEX">加權指數</SelectItem>
                                        <SelectItem value="SPX">S&P 500</SelectItem>
                                        <SelectItem value="NDX">納斯達克 100</SelectItem>
                                        <SelectItem value="BTC">Bitcoin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="portfolio-cash">初始現金</Label>
                                <Input
                                    id="portfolio-cash"
                                    type="number"
                                    value={formCash}
                                    onChange={(e) => setFormCash(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCreatePortfolio} disabled={!formName}>
                                <Save className="h-4 w-4 mr-2" />
                                建立組合
                            </Button>
                            <Button variant="outline" onClick={resetCreateForm}>
                                取消
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Portfolio Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {portfolios.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${selectedId === p.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                    >
                        <Wallet className="h-4 w-4" />
                        <span className="font-medium">{p.name}</span>
                        <Badge variant={p.totalPnL >= 0 ? 'default' : 'destructive'} className="text-xs">
                            {formatPct(p.totalPnLPct)}
                        </Badge>
                    </button>
                ))}
            </div>

            {activePortfolio && (
                <>
                    {/* Portfolio Actions */}
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowAddPosition(true)}>
                            <Plus className="w-4 h-4 mr-1" />
                            新增持倉
                        </Button>
                        <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4 mr-1" />
                            編輯組合
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                            if (!activePortfolio) return;
                            exportCSV(activePortfolio.positions.map(p => ({
                                '代碼': p.symbol,
                                '名稱': p.name,
                                '數量': p.quantity,
                                '成本價': p.avgCost,
                                '現價': p.currentPrice,
                                '市值': p.marketValue,
                                '未實現損益': p.unrealizedPnL,
                                '損益率%': p.unrealizedPnLPct,
                                '佔比%': p.weight,
                            })), `portfolio_${activePortfolio.name}`);
                        }}>
                            <Download className="w-4 h-4 mr-1" />
                            匯出 CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePortfolio(activePortfolio.id)}
                            disabled={portfolios.length <= 1}
                            className="text-red-500 hover:text-red-600"
                        >
                            <Trash2 className="w-4 h-4 mr-1" />
                            刪除
                        </Button>
                    </div>

                    {/* Add Position Form */}
                    {showAddPosition && (
                        <Card className="border-green-500">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between text-base">
                                    <span>新增持倉到 {activePortfolio.name}</span>
                                    <Button variant="ghost" size="icon" onClick={resetAddPositionForm}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-4">
                                    <div className="space-y-2">
                                        <Label>股票代碼 *</Label>
                                        <Input
                                            value={posSymbol}
                                            onChange={(e) => setPosSymbol(e.target.value)}
                                            placeholder="2330"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>股票名稱</Label>
                                        <Input
                                            value={posName}
                                            onChange={(e) => setPosName(e.target.value)}
                                            placeholder="台積電"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>數量 *</Label>
                                        <Input
                                            type="number"
                                            value={posQuantity}
                                            onChange={(e) => setPosQuantity(e.target.value)}
                                            placeholder="1000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>成本價 *</Label>
                                        <Input
                                            type="number"
                                            value={posCost}
                                            onChange={(e) => setPosCost(e.target.value)}
                                            placeholder="600"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={handleAddPosition} disabled={!posSymbol || !posQuantity || !posCost}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        新增
                                    </Button>
                                    <Button variant="outline" onClick={resetAddPositionForm}>
                                        取消
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* 總市值 - Blue accent */}
                        <Card className="bg-card border-blue-500/30 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                                <CardTitle className="text-sm font-medium text-muted-foreground">總市值</CardTitle>
                                <div className="p-2 rounded-lg bg-blue-500/20">
                                    <Wallet className="h-4 w-4 text-blue-400" />
                                </div>
                            </CardHeader>
                            <CardContent className="relative">
                                <div className="text-2xl font-bold text-foreground">
                                    {formatCurrency(activePortfolio.totalValue, activePortfolio.currency)}
                                </div>
                                <p className="text-xs text-blue-400">
                                    成本 {formatCurrency(activePortfolio.totalCost, activePortfolio.currency)}
                                </p>
                            </CardContent>
                        </Card>

                        {/* 總損益 - Green/Red accent */}
                        <Card className={`bg-card relative overflow-hidden ${activePortfolio.totalPnL >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${activePortfolio.totalPnL >= 0 ? 'from-green-500/10' : 'from-red-500/10'} to-transparent pointer-events-none`} />
                            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                                <CardTitle className="text-sm font-medium text-muted-foreground">總損益</CardTitle>
                                <div className={`p-2 rounded-lg ${activePortfolio.totalPnL >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                    {activePortfolio.totalPnL >= 0 ? (
                                        <ArrowUpRight className="h-4 w-4 text-green-400" />
                                    ) : (
                                        <ArrowDownRight className="h-4 w-4 text-red-400" />
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="relative">
                                <div className={`text-2xl font-bold ${pnlColor}`}>
                                    {formatCurrency(activePortfolio.totalPnL, activePortfolio.currency)}
                                </div>
                                <p className={`text-xs ${pnlColor}`}>
                                    {formatPct(activePortfolio.totalPnLPct)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">今日損益</CardTitle>
                                {activePortfolio.dailyPnL >= 0 ? (
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                ) : (
                                    <TrendingDown className="h-4 w-4 text-red-500" />
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${dailyPnlColor}`}>
                                    {formatCurrency(activePortfolio.dailyPnL, activePortfolio.currency)}
                                </div>
                                <p className={`text-xs ${dailyPnlColor}`}>
                                    {formatPct(activePortfolio.dailyPnLPct)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">持倉 / 現金</CardTitle>
                                <PieChart className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {activePortfolio.positions.length} 檔
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    現金 {formatCurrency(activePortfolio.cashBalance, activePortfolio.currency)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Positions Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                持倉明細
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {activePortfolio.positions.length === 0 ? (
                                <div className="text-center py-12">
                                    <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground mb-4">尚無持倉</p>
                                    <Button variant="outline" onClick={() => setShowAddPosition(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        新增第一筆持倉
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b text-left text-sm text-muted-foreground">
                                                <th className="pb-3 font-medium">標的</th>
                                                <th className="pb-3 font-medium text-right">數量</th>
                                                <th className="pb-3 font-medium text-right">成本</th>
                                                <th className="pb-3 font-medium text-right">現價</th>
                                                <th className="pb-3 font-medium text-right">市值</th>
                                                <th className="pb-3 font-medium text-right">損益</th>
                                                <th className="pb-3 font-medium text-right">佔比</th>
                                                <th className="pb-3 font-medium text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activePortfolio.positions.map((position) => {
                                                const isProfitable = position.unrealizedPnL >= 0;
                                                return (
                                                    <tr key={position.id} className="border-b last:border-0 hover:bg-muted/50">
                                                        <td className="py-3">
                                                            <div className="font-medium">{position.symbol}</div>
                                                            <div className="text-xs text-muted-foreground">{position.name}</div>
                                                        </td>
                                                        <td className="py-3 text-right">{position.quantity.toLocaleString()}</td>
                                                        <td className="py-3 text-right">{formatCurrency(position.avgCost, activePortfolio.currency)}</td>
                                                        <td className="py-3 text-right">{formatCurrency(position.currentPrice, activePortfolio.currency)}</td>
                                                        <td className="py-3 text-right font-medium">{formatCurrency(position.marketValue, activePortfolio.currency)}</td>
                                                        <td className={`py-3 text-right ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                                                            <div>{formatCurrency(position.unrealizedPnL, activePortfolio.currency)}</div>
                                                            <div className="text-xs">{formatPct(position.unrealizedPnLPct)}</div>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <Badge variant="secondary">{position.weight.toFixed(1)}%</Badge>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <Edit className="h-3 w-3" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Risk Metrics */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                風險指標
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="text-xs text-muted-foreground mb-1">Sharpe Ratio</div>
                                    <div className="text-lg font-semibold">
                                        {activePortfolio.riskMetrics.sharpeRatio.toFixed(2)}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="text-xs text-muted-foreground mb-1">年化波動率</div>
                                    <div className="text-lg font-semibold">
                                        {(activePortfolio.riskMetrics.annualizedVolatility * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="text-xs text-muted-foreground mb-1">最大回撤</div>
                                    <div className="text-lg font-semibold text-red-500">
                                        {(activePortfolio.riskMetrics.maxDrawdown * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="text-xs text-muted-foreground mb-1">Beta</div>
                                    <div className="text-lg font-semibold">
                                        {activePortfolio.riskMetrics.beta.toFixed(2)}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="text-xs text-muted-foreground mb-1">VaR (95%)</div>
                                    <div className="text-lg font-semibold text-yellow-500">
                                        {formatCurrency(activePortfolio.riskMetrics.var95, activePortfolio.currency)}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="text-xs text-muted-foreground mb-1">前5持倉佔比</div>
                                    <div className="text-lg font-semibold">
                                        {(activePortfolio.riskMetrics.top5Weight * 100).toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Portfolio Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                組合資訊
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-4">
                                <div>
                                    <div className="text-xs text-muted-foreground">描述</div>
                                    <div className="font-medium">{activePortfolio.description || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">幣別</div>
                                    <div className="font-medium">{activePortfolio.currency}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">基準指數</div>
                                    <div className="font-medium">{activePortfolio.benchmark || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">建立日期</div>
                                    <div className="font-medium">{activePortfolio.createdAt}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
