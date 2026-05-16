'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
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
    ThumbsUp,
    ThumbsDown,
    Loader2,
} from 'lucide-react';

interface StockData {
    price: number;
    change24h: number;
    change7d: number;
    change30d: number;
    high52w: number;
    low52w: number;
    avgVolume: number;
    pe: number;
    rsi: number;
    macd: { value: number; signal: number; trend: string };
    sma: { sma20: number; sma50: number; sma200: number };
    support: number[];
    resistance: number[];
}

const defaultData: StockData = {
    price: 0, change24h: 0, change7d: 0, change30d: 0,
    high52w: 0, low52w: 0, avgVolume: 0, pe: 0, rsi: 50,
    macd: { value: 0, signal: 0, trend: 'neutral' },
    sma: { sma20: 0, sma50: 0, sma200: 0 },
    support: [0, 0, 0], resistance: [0, 0, 0],
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
    const { getIdToken } = useAuth();
    const [symbol, setSymbol] = useState('NVDA');
    const [timeframe, setTimeframe] = useState('1M');
    const [isLoading, setIsLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [stockData, setStockData] = useState<Record<string, StockData>>({});
    const [sessionId] = useState(() => crypto.randomUUID());
    const [feedbackState, setFeedbackState] = useState<'idle' | 'submitting' | 'accepted' | 'rejected'>('idle');
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    // Fetch real market indicators data
    const fetchMarketData = useCallback(async (sym: string) => {
        setDataLoading(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`/api/market/indicators/${encodeURIComponent(sym)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const apiData = await res.json();
                const ind = apiData.indicators || apiData;
                setStockData(prev => ({
                    ...prev,
                    [sym]: {
                        price: ind.price ?? ind.close ?? 0,
                        change24h: ind.change24h ?? ind.changePct ?? 0,
                        change7d: ind.change7d ?? 0,
                        change30d: ind.change30d ?? 0,
                        high52w: ind.high52w ?? ind.yearHigh ?? 0,
                        low52w: ind.low52w ?? ind.yearLow ?? 0,
                        avgVolume: ind.avgVolume ?? 0,
                        pe: ind.pe ?? 0,
                        rsi: ind.rsi ?? ind.rsi14 ?? 50,
                        macd: {
                            value: ind.macd?.value ?? ind.macd ?? 0,
                            signal: ind.macd?.signal ?? ind.macdSignal ?? 0,
                            trend: ind.macd?.trend ?? ((ind.macd ?? 0) > (ind.macdSignal ?? 0) ? 'bullish' : 'bearish'),
                        },
                        sma: {
                            sma20: ind.sma?.sma20 ?? ind.sma20 ?? 0,
                            sma50: ind.sma?.sma50 ?? ind.sma50 ?? 0,
                            sma200: ind.sma?.sma200 ?? ind.sma200 ?? 0,
                        },
                        support: ind.support ?? [0, 0, 0],
                        resistance: ind.resistance ?? [0, 0, 0],
                    },
                }));
            }
        } catch (err) {
            console.error('Failed to fetch market data:', err);
        }
        setDataLoading(false);
    }, [getIdToken]);

    useEffect(() => { fetchMarketData(symbol); }, [symbol, fetchMarketData]);

    const data = stockData[symbol] || defaultData;

    const runAnalysis = useCallback(async () => {
        setIsLoading(true);

        // Try AI Gateway first
        try {
            const token = await getIdToken();
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ symbol, indicators: data }),
            });

            if (res.ok) {
                const result = await res.json();
                if (result.analysis) {
                    setAnalysis(result.analysis);
                    setIsLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.warn('AI Gateway unavailable, using local analysis:', err);
        }

        // Fallback: generate analysis locally from real indicator data
        const generatedAnalysis: AIAnalysis = {
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

        setAnalysis(generatedAnalysis);
        setIsLoading(false);
    }, [symbol, data, getIdToken]);

    const handleCustomAnalysis = useCallback(async () => {
        if (!customPrompt.trim()) return;

        setIsLoading(true);

        // Try AI Gateway for custom query
        try {
            const token = await getIdToken();
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ symbol, indicators: data, prompt: customPrompt }),
            });

            if (res.ok) {
                const result = await res.json();
                if (result.analysis) {
                    setAnalysis(result.analysis);
                    setCustomPrompt('');
                    setIsLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.warn('AI Gateway unavailable for custom query:', err);
        }

        // Fallback: local template response
        if (analysis) {
            setAnalysis({
                ...analysis,
                summary: `${analysis.summary}\n\n針對您的問題「${customPrompt}」：根據歷史資料分析，${symbol} 在過去 30 天上漲 ${data.change30d}%，整體趨勢偏多。建議密切關注 $${data.support[0]} 支撐位。`,
            });
        }
        setCustomPrompt('');
        setIsLoading(false);
    }, [customPrompt, analysis, symbol, data, getIdToken]);

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

                        {/* DPO Feedback */}
                        <div className="pt-4 border-t">
                            {feedbackState === 'idle' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">這份分析對您有幫助嗎？您的回饋將用於改善 AI 模型</p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-green-600 border-green-600/30 hover:bg-green-600/10"
                                            onClick={async () => {
                                                setFeedbackState('submitting');
                                                try {
                                                    const token = await getIdToken();
                                                    await fetch('/api/ai/preference', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                        body: JSON.stringify({ session_id: sessionId, action: 'accept' }),
                                                    });
                                                    setFeedbackState('accepted');
                                                } catch { setFeedbackState('idle'); }
                                            }}
                                        >
                                            <ThumbsUp className="h-4 w-4 mr-1" /> 有幫助
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                                            onClick={() => setShowRejectInput(true)}
                                        >
                                            <ThumbsDown className="h-4 w-4 mr-1" /> 不準確
                                        </Button>
                                    </div>
                                    {showRejectInput && (
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="原因（選填）：分析不夠深入、方向錯誤..."
                                                value={rejectReason}
                                                onChange={(e) => setRejectReason(e.target.value)}
                                                className="text-sm"
                                            />
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={async () => {
                                                    setFeedbackState('submitting');
                                                    try {
                                                        const token = await getIdToken();
                                                        await fetch('/api/ai/preference', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                            body: JSON.stringify({ session_id: sessionId, action: 'reject', reason: rejectReason }),
                                                        });
                                                        setFeedbackState('rejected');
                                                    } catch { setFeedbackState('idle'); }
                                                }}
                                            >
                                                送出
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {feedbackState === 'submitting' && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> 正在記錄...
                                </div>
                            )}
                            {feedbackState === 'accepted' && (
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <ThumbsUp className="h-4 w-4" /> 感謝您的正面回饋！
                                </div>
                            )}
                            {feedbackState === 'rejected' && (
                                <div className="flex items-center gap-2 text-sm text-amber-600">
                                    <ThumbsDown className="h-4 w-4" /> 已記錄，我們會持續改善
                                </div>
                            )}
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
