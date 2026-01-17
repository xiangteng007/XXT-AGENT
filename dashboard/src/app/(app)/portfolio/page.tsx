'use client';

import { useState, useMemo } from 'react';
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

// Mock portfolios
const mockPortfolios: Portfolio[] = [
    {
        id: '1', name: '主要投資組合', description: '長期價值投資', currency: 'TWD', benchmark: 'TAIEX', isDefault: true,
        createdAt: '2024-01-15', totalValue: 5250000, totalCost: 4800000, totalPnL: 450000, totalPnLPct: 9.38,
        dailyPnL: 32500, dailyPnLPct: 0.62, cashBalance: 450000,
        positions: [
            { id: '1', symbol: '2330', name: '台積電', quantity: 5000, avgCost: 580, currentPrice: 620, marketValue: 3100000, unrealizedPnL: 200000, unrealizedPnLPct: 6.9, weight: 59.0 },
            { id: '2', symbol: '2317', name: '鴻海', quantity: 10000, avgCost: 105, currentPrice: 115, marketValue: 1150000, unrealizedPnL: 100000, unrealizedPnLPct: 9.5, weight: 21.9 },
            { id: '3', symbol: '2454', name: '聯發科', quantity: 500, avgCost: 980, currentPrice: 1100, marketValue: 550000, unrealizedPnL: 60000, unrealizedPnLPct: 12.2, weight: 10.5 },
        ],
        riskMetrics: { sharpeRatio: 1.85, annualizedVolatility: 0.18, maxDrawdown: -0.12, beta: 1.15, var95: -125000, top5Weight: 0.91 },
    },
    {
        id: '2', name: '美股投資組合', description: '科技股為主', currency: 'USD', benchmark: 'SPX', isDefault: false,
        createdAt: '2024-06-01', totalValue: 85000, totalCost: 72000, totalPnL: 13000, totalPnLPct: 18.06,
        dailyPnL: 1250, dailyPnLPct: 1.49, cashBalance: 5000,
        positions: [
            { id: '4', symbol: 'AAPL', name: 'Apple Inc.', quantity: 100, avgCost: 165, currentPrice: 186, marketValue: 18600, unrealizedPnL: 2100, unrealizedPnLPct: 12.7, weight: 21.9 },
            { id: '5', symbol: 'NVDA', name: 'NVIDIA', quantity: 50, avgCost: 480, currentPrice: 925, marketValue: 46250, unrealizedPnL: 22250, unrealizedPnLPct: 92.7, weight: 54.4 },
            { id: '6', symbol: 'MSFT', name: 'Microsoft', quantity: 40, avgCost: 320, currentPrice: 425, marketValue: 17000, unrealizedPnL: 4200, unrealizedPnLPct: 32.8, weight: 20.0 },
        ],
        riskMetrics: { sharpeRatio: 2.35, annualizedVolatility: 0.25, maxDrawdown: -0.18, beta: 1.35, var95: -8500, top5Weight: 0.96 },
    },
    {
        id: '3', name: '加密貨幣', description: '高風險配置', currency: 'USD', benchmark: 'BTC', isDefault: false,
        createdAt: '2024-09-01', totalValue: 25000, totalCost: 20000, totalPnL: 5000, totalPnLPct: 25.00,
        dailyPnL: 850, dailyPnLPct: 3.52, cashBalance: 2000,
        positions: [
            { id: '7', symbol: 'BTC', name: 'Bitcoin', quantity: 0.15, avgCost: 65000, currentPrice: 98500, marketValue: 14775, unrealizedPnL: 5025, unrealizedPnLPct: 51.5, weight: 59.1 },
            { id: '8', symbol: 'ETH', name: 'Ethereum', quantity: 2.5, avgCost: 2800, currentPrice: 3500, marketValue: 8750, unrealizedPnL: 1750, unrealizedPnLPct: 25.0, weight: 35.0 },
        ],
        riskMetrics: { sharpeRatio: 1.20, annualizedVolatility: 0.65, maxDrawdown: -0.35, beta: 2.10, var95: -6250, top5Weight: 0.94 },
    },
];

export default function PortfolioPage() {
    const [portfolios, setPortfolios] = useState<Portfolio[]>(mockPortfolios);
    const [selectedId, setSelectedId] = useState<string>(mockPortfolios[0].id);
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

    const handleCreatePortfolio = () => {
        const newPortfolio: Portfolio = {
            id: Date.now().toString(),
            name: formName,
            description: formDescription,
            currency: formCurrency,
            benchmark: formBenchmark,
            isDefault: portfolios.length === 0,
            createdAt: new Date().toISOString().split('T')[0],
            totalValue: parseFloat(formCash) || 0,
            totalCost: 0,
            totalPnL: 0,
            totalPnLPct: 0,
            dailyPnL: 0,
            dailyPnLPct: 0,
            cashBalance: parseFloat(formCash) || 0,
            positions: [],
            riskMetrics: { sharpeRatio: 0, annualizedVolatility: 0, maxDrawdown: 0, beta: 0, var95: 0, top5Weight: 0 },
        };
        setPortfolios(prev => [...prev, newPortfolio]);
        setSelectedId(newPortfolio.id);
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

    const handleDeletePortfolio = (id: string) => {
        if (portfolios.length <= 1) return;
        setPortfolios(prev => prev.filter(p => p.id !== id));
        if (selectedId === id) {
            setSelectedId(portfolios.find(p => p.id !== id)?.id || '');
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
                        <Briefcase className="h-6 w-6" />
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
                        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">總市值</CardTitle>
                                <Wallet className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(activePortfolio.totalValue, activePortfolio.currency)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    成本 {formatCurrency(activePortfolio.totalCost, activePortfolio.currency)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className={`bg-gradient-to-br ${activePortfolio.totalPnL >= 0 ? 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">總損益</CardTitle>
                                {activePortfolio.totalPnL >= 0 ? (
                                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                                ) : (
                                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                                )}
                            </CardHeader>
                            <CardContent>
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
