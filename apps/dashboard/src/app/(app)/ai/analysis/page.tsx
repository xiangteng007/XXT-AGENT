'use client';

import { useState, useCallback } from 'react';
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
import { LoadingSkeleton } from '@/components/shared';
import {
    Brain,
    TrendingUp,
    TrendingDown,
    BarChart3,
    LineChart,
    Target,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    Send,
} from 'lucide-react';

// Mock historical data
const mockHistoricalData = {
    NVDA: {
        price: 924.50,
        change24h: 3.16,
        change7d: 8.5,
        change30d: 25.2,
        high52w: 974.00,
        low52w: 378.00,
        avgVolume: 45000000,
        pe: 68.5,
        rsi: 68,
        macd: { value: 22.8, signal: 18.5, trend: 'bullish' },
        sma: { sma20: 912, sma50: 875, sma200: 720 },
        support: [900, 875, 850],
        resistance: [950, 980, 1000],
    },
    AAPL: {
        price: 185.92,
        change24h: 1.34,
        change7d: 2.1,
        change30d: 5.8,
        high52w: 199.62,
        low52w: 164.08,
        avgVolume: 52000000,
        pe: 29.8,
        rsi: 55,
        macd: { value: 1.35, signal: 0.95, trend: 'neutral' },
        sma: { sma20: 183, sma50: 178, sma200: 175 },
        support: [180, 175, 170],
        resistance: [190, 195, 200],
    },
};

interface AIAnalysis {
    summary: string;
    technicalSignal: 'bullish' | 'bearish' | 'neutral';
    riskLevel: 'low' | 'medium' | 'high';
    keyPoints: string[];
    recommendation: string;
    priceTargets: { short: number; medium: number; long: number };
}

export default function AIAnalysisPage() {
    const [symbol, setSymbol] = useState('NVDA');
    const [timeframe, setTimeframe] = useState('1M');
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');

    const data = mockHistoricalData[symbol as keyof typeof mockHistoricalData] || mockHistoricalData.NVDA;

    const runAnalysis = useCallback(async () => {
        setIsLoading(true);

        // Simulate API call to ai-gateway
        await new Promise(resolve => setTimeout(resolve, 2000));

        const mockAnalysis: AIAnalysis = {
            summary: `${symbol} 目前處於強勢上漲趨勢。根據技術指標分析，RSI 為 ${data.rsi}，顯示${data.rsi > 70 ? '超買' : data.rsi < 30 ? '超賣' : '正常'}區間。MACD 呈現 ${data.macd.trend === 'bullish' ? '金叉' : '死叉'} 訊號。價格目前位於 20 日均線上方，短期趨勢偏多。`,
            technicalSignal: data.macd.trend as 'bullish' | 'bearish' | 'neutral',
            riskLevel: data.rsi > 70 ? 'high' : data.rsi < 30 ? 'low' : 'medium',
            keyPoints: [
                `RSI 指標: ${data.rsi} (${data.rsi > 70 ? '超買警告' : data.rsi < 30 ? '超賣機會' : '中性'})`,
                `MACD: ${data.macd.value.toFixed(2)} (${data.macd.trend === 'bullish' ? '看漲' : '看跌'})`,
                `支撐位: $${data.support[0]}、$${data.support[1]}`,
                `阻力位: $${data.resistance[0]}、$${data.resistance[1]}`,
                `52週高低: $${data.low52w} - $${data.high52w}`,
            ],
            recommendation: data.macd.trend === 'bullish'
                ? `建議在 $${data.support[0]} 附近逢低佈局，目標價 $${data.resistance[0]}。設定停損於 $${data.support[1]}。`
                : `建議觀望或減倉，等待 $${data.support[0]} 支撐確認後再進場。`,
            priceTargets: {
                short: data.resistance[0],
                medium: data.resistance[1],
                long: data.resistance[2],
            },
        };

        setAnalysis(mockAnalysis);
        setIsLoading(false);
    }, [symbol, data]);

    const handleCustomAnalysis = useCallback(async () => {
        if (!customPrompt.trim()) return;

        setIsLoading(true);
        // In real implementation, this would call the ai-gateway with the custom prompt
        await new Promise(resolve => setTimeout(resolve, 1500));

        // For demo, just update the summary
        if (analysis) {
            setAnalysis({
                ...analysis,
                summary: `${analysis.summary}\n\n針對您的問題「${customPrompt}」：根據歷史資料分析，${symbol} 在過去 30 天上漲 ${data.change30d}%，整體趨勢偏多。建議密切關注 $${data.support[0]} 支撐位。`,
            });
        }
        setCustomPrompt('');
        setIsLoading(false);
    }, [customPrompt, analysis, symbol, data]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Brain className="h-6 w-6" />
                        AI 智能分析
                    </h1>
                    <p className="text-muted-foreground">
                        基於歷史資料與技術指標的 AI 投資分析
                    </p>
                </div>
            </div>

            {/* Symbol & Timeframe Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>選擇標的</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 flex-wrap">
                        <div className="w-48">
                            <Label>股票代碼</Label>
                            <Select value={symbol} onValueChange={setSymbol}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NVDA">NVDA - NVIDIA</SelectItem>
                                    <SelectItem value="AAPL">AAPL - Apple</SelectItem>
                                    <SelectItem value="TSLA">TSLA - Tesla</SelectItem>
                                    <SelectItem value="MSFT">MSFT - Microsoft</SelectItem>
                                    <SelectItem value="GOOGL">GOOGL - Alphabet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-48">
                            <Label>時間區間</Label>
                            <Select value={timeframe} onValueChange={setTimeframe}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1D">1 日</SelectItem>
                                    <SelectItem value="1W">1 週</SelectItem>
                                    <SelectItem value="1M">1 月</SelectItem>
                                    <SelectItem value="3M">3 月</SelectItem>
                                    <SelectItem value="1Y">1 年</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={runAnalysis} disabled={isLoading}>
                                {isLoading ? (
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Brain className="h-4 w-4 mr-2" />
                                )}
                                執行分析
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Overview */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">目前價格</div>
                        <div className="text-2xl font-bold">${data.price.toFixed(2)}</div>
                        <Badge variant={data.change24h >= 0 ? 'default' : 'destructive'}>
                            {data.change24h >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                            {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
                        </Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">7 日變化</div>
                        <div className={`text-2xl font-bold ${data.change7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {data.change7d >= 0 ? '+' : ''}{data.change7d.toFixed(2)}%
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">30 日變化</div>
                        <div className={`text-2xl font-bold ${data.change30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {data.change30d >= 0 ? '+' : ''}{data.change30d.toFixed(2)}%
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">RSI (14)</div>
                        <div className="text-2xl font-bold">{data.rsi}</div>
                        <Badge variant={data.rsi > 70 ? 'destructive' : data.rsi < 30 ? 'default' : 'secondary'}>
                            {data.rsi > 70 ? '超買' : data.rsi < 30 ? '超賣' : '正常'}
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            {/* Technical Indicators */}
            <Tabs defaultValue="indicators">
                <TabsList>
                    <TabsTrigger value="indicators">技術指標</TabsTrigger>
                    <TabsTrigger value="levels">支撐/阻力</TabsTrigger>
                </TabsList>
                <TabsContent value="indicators">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <h4 className="font-medium mb-2">移動平均線</h4>
                                    <div className="space-y-1 text-sm">
                                        <div>SMA20: ${data.sma.sma20}</div>
                                        <div>SMA50: ${data.sma.sma50}</div>
                                        <div>SMA200: ${data.sma.sma200}</div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-medium mb-2">MACD</h4>
                                    <div className="space-y-1 text-sm">
                                        <div>MACD: {data.macd.value.toFixed(2)}</div>
                                        <div>Signal: {data.macd.signal.toFixed(2)}</div>
                                        <Badge variant={data.macd.trend === 'bullish' ? 'default' : 'destructive'}>
                                            {data.macd.trend === 'bullish' ? '看漲' : '看跌'}
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-medium mb-2">估值</h4>
                                    <div className="space-y-1 text-sm">
                                        <div>P/E: {data.pe}</div>
                                        <div>52週高: ${data.high52w}</div>
                                        <div>52週低: ${data.low52w}</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="levels">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <TrendingDown className="h-4 w-4 text-green-600" />
                                        支撐位
                                    </h4>
                                    <div className="space-y-2">
                                        {data.support.map((level, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                                                <span>S{i + 1}</span>
                                                <span className="font-medium">${level}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 text-red-600" />
                                        阻力位
                                    </h4>
                                    <div className="space-y-2">
                                        {data.resistance.map((level, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                                <span>R{i + 1}</span>
                                                <span className="font-medium">${level}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* AI Analysis Result */}
            {isLoading && <LoadingSkeleton type="card" count={1} />}

            {analysis && !isLoading && (
                <Card className="border-primary/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-primary" />
                            AI 分析報告
                        </CardTitle>
                        <CardDescription>
                            基於 {symbol} 歷史資料與技術指標
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Signal & Risk */}
                        <div className="flex gap-4">
                            <Badge variant={analysis.technicalSignal === 'bullish' ? 'default' : analysis.technicalSignal === 'bearish' ? 'destructive' : 'secondary'} className="text-sm py-1 px-3">
                                {analysis.technicalSignal === 'bullish' ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                                {analysis.technicalSignal === 'bullish' ? '看漲' : analysis.technicalSignal === 'bearish' ? '看跌' : '中性'}
                            </Badge>
                            <Badge variant={analysis.riskLevel === 'high' ? 'destructive' : analysis.riskLevel === 'low' ? 'default' : 'secondary'} className="text-sm py-1 px-3">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                風險: {analysis.riskLevel === 'high' ? '高' : analysis.riskLevel === 'low' ? '低' : '中'}
                            </Badge>
                        </div>

                        {/* Summary */}
                        <div>
                            <h4 className="font-medium mb-2">摘要</h4>
                            <p className="text-muted-foreground whitespace-pre-line">{analysis.summary}</p>
                        </div>

                        {/* Key Points */}
                        <div>
                            <h4 className="font-medium mb-2">關鍵指標</h4>
                            <ul className="space-y-1">
                                {analysis.keyPoints.map((point, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Recommendation */}
                        <div className="p-4 bg-primary/5 rounded-lg">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                投資建議
                            </h4>
                            <p>{analysis.recommendation}</p>
                        </div>

                        {/* Price Targets */}
                        <div className="grid gap-2 md:grid-cols-3">
                            <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-sm text-muted-foreground">短期目標</div>
                                <div className="text-lg font-bold">${analysis.priceTargets.short}</div>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-sm text-muted-foreground">中期目標</div>
                                <div className="text-lg font-bold">${analysis.priceTargets.medium}</div>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-sm text-muted-foreground">長期目標</div>
                                <div className="text-lg font-bold">${analysis.priceTargets.long}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Custom Query */}
            {analysis && (
                <Card>
                    <CardHeader>
                        <CardTitle>追問 AI</CardTitle>
                        <CardDescription>
                            針對 {symbol} 的歷史資料提出具體問題
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <Input
                                placeholder="例如: 這檔股票適合現在買入嗎？"
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCustomAnalysis()}
                            />
                            <Button onClick={handleCustomAnalysis} disabled={isLoading || !customPrompt.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
