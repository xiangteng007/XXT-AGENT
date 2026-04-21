'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuotes, useWatchlist, useMarketMutations, useCandles, useMacroCalendar, calculatePivotPoints } from '@/lib/hooks/useMarketData';
import { calculateAllIndicators, type OHLCV } from '@/lib/indicators/technical';
import { useWarRoomStore } from '@/lib/store/warRoomStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CandlestickChart, type ChartIndicators } from '@/components/market/CandlestickChart';
import { LoadingSkeleton, AdvancedFilters, QuickFilters } from '@/components/shared';
import { useNewsArticles } from '@/lib/hooks/useNewsData';
import { useSocialPosts } from '@/lib/hooks/useSocialData';
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
    ShieldAlert,
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
    const { openCommsPanel, addMessage, setAgentTyping, chatHistory, agentTypingStatus } = useWarRoomStore();
    const { events: macroEvents } = useMacroCalendar();
    
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    
    // Add hooks for News and Social Data. They depend on the selected symbol.
    const { articles: newsArticles } = useNewsArticles({ symbol: selectedSymbol || undefined });
    const { posts: socialPosts } = useSocialPosts({ keyword: selectedSymbol || undefined });

    const [showAIAnalysis, setShowAIAnalysis] = useState(false);
    const [lastAdviceContext, setLastAdviceContext] = useState<{ symbol: string, inds: any, latestValues: any } | null>(null);
    const prevDataRef = useRef({ newsCount: 0, socialCount: 0, candleCount: 0 });

    const watchlistSymbols = useMemo(() => {
        return watchlistItems.map(item => item.symbol);
    }, [watchlistItems]);

    const { quotes: apiQuotes, isLoading, refresh } = useQuotes(defaultSymbols);

    const quotes = apiQuotes.length > 0 ? apiQuotes : mockQuotes;

    const [filters, setFilters] = useState<Record<string, string | string[]>>({});
    const [sortField, setSortField] = useState<SortField>('symbol');
    const [sortAsc, setSortAsc] = useState(true);

    const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'YTD' | '5Y'>('1Y');
    const [indicators, setIndicators] = useState<ChartIndicators>({
        ma: true,
        ema: false,
        bb: false,
        macd: false,
        rsi: false,
        kd: false,
        srLevels: false,
        fibonacci: false,
        patterns: false
    });

    const today = useMemo(() => new Date().toISOString().split('T')[0], []);
    const startDate = useMemo(() => {
        const d = new Date();
        if (timeRange === '1M') d.setMonth(d.getMonth() - 1);
        else if (timeRange === '3M') d.setMonth(d.getMonth() - 3);
        else if (timeRange === '6M') d.setMonth(d.getMonth() - 6);
        else if (timeRange === '1Y') d.setFullYear(d.getFullYear() - 1);
        else if (timeRange === '5Y') d.setFullYear(d.getFullYear() - 5);
        else if (timeRange === 'YTD') {
            d.setMonth(0);
            d.setDate(1);
        }
        return d.toISOString().split('T')[0];
    }, [timeRange]);

    const { candles, isLoading: isCandlesLoading } = useCandles(selectedSymbol || '', startDate, today);

    const triggerAIAnalysis = useCallback((symbol: string, inds: any, latestValues: any, isAutoUpdate: boolean = false) => {
        const quote = quotes.find(q => q.symbol === symbol);
        const recentCandles = candles.slice(-5).map(c => `[${c.time.split('T')[0]}] 開:${c.open.toFixed(2)} 高:${c.high.toFixed(2)} 低:${c.low.toFixed(2)} 收:${c.close.toFixed(2)} 量:${c.volume?.toLocaleString()}`).join('\n');
        const activeInds = Object.entries(inds).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', ') || '純 K 線';
        
        // 1. Calculate Pivot Points from the last candle
        const lastCandle = candles[candles.length - 1];
        let pivotPointsInfo = '無法計算';
        if (lastCandle) {
            const pp = calculatePivotPoints(lastCandle.high, lastCandle.low, lastCandle.close);
            pivotPointsInfo = `Pivot Point (P): ${pp.p.toFixed(2)}
支撐位 (S1/S2/S3): ${pp.s1.toFixed(2)} / ${pp.s2.toFixed(2)} / ${pp.s3.toFixed(2)}
壓力位 (R1/R2/R3): ${pp.r1.toFixed(2)} / ${pp.r2.toFixed(2)} / ${pp.r3.toFixed(2)}`;
        }

        // 2. Format Macro Events
        const macroInfo = macroEvents.map(e => `[${e.date}] ${e.title} (${e.impact} 影響)`).join('\n');
        
        // 2.5 Format News & Social Data
        const recentNews = newsArticles.slice(0, 3).map(n => `[${n.publishedAt.split('T')[0]}] ${n.title} (情緒: ${n.sentiment?.sentiment || '中立'}) - ${n.summary}`).join('\n');
        const recentSocial = socialPosts.slice(0, 5).map(p => `[${p.platform}] ${p.author.username} (互動: ${p.engagement.total}): ${p.content}`).join('\n');
        const newsInfo = recentNews || '近期無重大新聞';
        const socialInfo = recentSocial || '近期無相關社群討論';

        // 3. Format Latest Indicator Values
        const formatLatestValues = (values: any) => {
            if (!values || Object.keys(values).length === 0) return '無啟用技術指標即時數據';
            
            const lines = [];
            if (values.ma5) lines.push(`MA5: ${values.ma5.toFixed(2)}`);
            if (values.ma20) lines.push(`MA20: ${values.ma20.toFixed(2)}`);
            if (values.ma60) lines.push(`MA60: ${values.ma60.toFixed(2)}`);
            if (values.ema12) lines.push(`EMA12: ${values.ema12.toFixed(2)}`);
            if (values.ema26) lines.push(`EMA26: ${values.ema26.toFixed(2)}`);
            if (values.bb) lines.push(`布林通道 - 上軌: ${values.bb.upper.toFixed(2)}, 中軌: ${values.bb.middle.toFixed(2)}, 下軌: ${values.bb.lower.toFixed(2)}`);
            if (values.macd) lines.push(`MACD - MACD: ${values.macd.MACD?.toFixed(4) || 'N/A'}, Signal: ${values.macd.signal?.toFixed(4) || 'N/A'}, Hist: ${values.macd.histogram?.toFixed(4) || 'N/A'}`);
            if (values.rsi !== undefined) lines.push(`RSI(14): ${values.rsi.toFixed(2)}`);
            if (values.kd) lines.push(`KD - K: ${values.kd.k?.toFixed(2) || 'N/A'}, D: ${values.kd.d?.toFixed(2) || 'N/A'}`);
            
            return lines.length > 0 ? lines.join('\n') : '無指標數據';
        };
        const indicatorsInfo = formatLatestValues(latestValues);

        // 4. Construct Prompts
        const baseContext = `以下為 ${symbol} 的最新報價資訊：
- 現價: ${quote?.lastPrice} (${quote?.changePct !== undefined && quote?.changePct > 0 ? '+' : ''}${quote?.changePct}%)
- 52週高低: ${quote?.high52w} / ${quote?.low52w}
- 成交量: ${quote?.volume?.toLocaleString()} (量比: ${quote?.volumeRatio}x)

近期 K 線資料 (近5日):
${recentCandles}

自動化支撐壓力位 (Pivot Points):
${pivotPointsInfo}

當前技術指標即時數值:
${indicatorsInfo}

近期總經與財報事件:
${macroInfo}

近期相關新聞 (News):
${newsInfo}

社群監視 (Social Community):
${socialInfo}

使用者關注的技術指標：${activeInds}`;

        const isUpdateNotice = isAutoUpdate ? "【系統即時更新：偵測到新資訊，請進行滾動式修正與重新評估】\n" : "";

        const novaMsg = `${isUpdateNotice}請務必著重強調「技術分析」與「策略規劃」，並結合相關資料庫紀錄，給我專業的投資建議。

${baseContext}

請針對上述 K 線型態、價格趨勢、量價關係、技術指標數值、Pivot Points 以及總經事件，進行深度技術解讀。
【強制要求】：
1. 明確給出下單建議 (如：建議強烈買進 / 建議買進 / 建議持有 / 建議賣出 / 建議強烈賣出)。請注意：您必須清楚表明這僅為「分析建議 (Advice)」，而非實際的「交易行動 (Action)」。
2. 【核心要求】：任何給出的建議與目標價，都「必須」附上「明確的判斷依據」(例如支撐/壓力位、技術指標背離、量價配合等) 以及「明確的目標性」(例如預期報酬率、風險報酬比、或預計達成時間)。
3. 明確給出目標價格 (Target Price) 與適合的進場價格區間 (Entry Range)。
4. 若為滾動式更新，請明確對比前次狀態，給出投資部位的調整方向。`;

        const guardianMsg = `${isUpdateNotice}請您扮演「嚴格的風險控管員 (Risk Controller)」，專注於看跌情境與風險測試。

${baseContext}

請針對上述資訊，進行「下行風險 (Downside Risk)」評估、找出潛在的技術面破綻 (特別留意指標背離或超買超賣)、評估總經事件對市場的潛在打擊。
【強制要求】：
1. 明確給出嚴格的停損點 (Stop-loss) 設置建議。
2. 【核心要求】：任何給出的停損點與風險警告，都「必須」附上「明確的判斷依據」(例如跌破某條關鍵 MA、MACD 死叉、Pivot S1 被有效擊穿等)。
3. 找出潛在的極端下行風險與黑天鵝情境，警告可能的虧損情境。
4. 評估當前整體市場情緒風險等級 (低 / 中 / 高 / 極高風險)。`;

        const argusMsg = `${isUpdateNotice}請您扮演「OSINT 資訊驗證員 (Information Verifier)」，專注於新聞解讀、社群情緒監視與資訊交叉比對。

${baseContext}

請針對上述資訊進行「資訊驗證 (Information Verification)」。請交叉比對技術面價格走勢與新聞、社群熱度是否一致。
【強制要求】：
1. 找出潛在的盲點或炒作(如: 價格上漲但社群多為機器人炒作，或價格下跌但新聞顯示基本面穩健)。
2. 給出客觀可信的綜合投資建議，並與技術面交叉對比。
3. 【核心要求】：任何資訊驗證的結論，都「必須」附上「明確的判斷依據」(如引述具體的新聞數據、社群熱度異常或邏輯矛盾點)。
4. 若有高風險的社群炒作，請標示為【高風險】或【警告】；若基本面穩健則標示為【可信】或【安全】。`;
        
        // 5. Dispatch to Nova
        if (!isAutoUpdate) openCommsPanel('nova');
        addMessage('nova', { sender: 'user', content: novaMsg });
        setAgentTyping('nova', 'PERFORMING TECHNICAL ANALYSIS... (已載入指標)');
        
        const gatewayUrl = process.env.NEXT_PUBLIC_OPENCLAW_URL || 'http://localhost:3100';
        fetch(`${gatewayUrl}/agents/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_agent: 'nova',
                message: novaMsg,
                session_id: 'war-room',
                user_id: 'operator',
                history: []
            }),
        }).catch(error => {
            console.error('Nova Chat error:', error);
            addMessage('nova', { 
                sender: 'system', 
                content: 'ERROR: COMMUNICATION LINK DISRUPTED. PLEASE RETRY.' 
            });
            setAgentTyping('nova', null);
        });

        // 6. Dispatch to Guardian
        addMessage('guardian', { sender: 'user', content: guardianMsg });
        setAgentTyping('guardian', 'PERFORMING RISK ASSESSMENT & DOWNSIDE ANALYSIS... (已載入指標)');
        
        fetch(`${gatewayUrl}/agents/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_agent: 'guardian',
                message: guardianMsg,
                session_id: 'war-room',
                user_id: 'operator',
                history: []
            }),
        }).catch(error => {
            console.error('Guardian Chat error:', error);
            addMessage('guardian', { 
                sender: 'system', 
                content: 'ERROR: COMMUNICATION LINK DISRUPTED. PLEASE RETRY.' 
            });
            setAgentTyping('guardian', null);
        });

        // 7. Dispatch to Argus
        addMessage('argus', { sender: 'user', content: argusMsg });
        setAgentTyping('argus', 'PERFORMING OSINT VERIFICATION & CROSS-REFERENCING... (分析新聞與社群)');
        
        fetch(`${gatewayUrl}/agents/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_agent: 'argus',
                message: argusMsg,
                session_id: 'war-room',
                user_id: 'operator',
                history: []
            }),
        }).catch(error => {
            console.error('Argus Chat error:', error);
            addMessage('argus', { 
                sender: 'system', 
                content: 'ERROR: COMMUNICATION LINK DISRUPTED. PLEASE RETRY.' 
            });
            setAgentTyping('argus', null);
        });
    }, [quotes, candles, macroEvents, newsArticles, socialPosts, openCommsPanel, addMessage, setAgentTyping]);

    // Setup polling for automatic AI analysis when new data arrives
    useEffect(() => {
        if (!showAIAnalysis || !lastAdviceContext) return;
        
        const currentNewsCount = newsArticles.length;
        const currentSocialCount = socialPosts.length;
        const currentCandleCount = candles.length;
        
        const hasNewData = 
            (currentNewsCount > 0 && currentNewsCount !== prevDataRef.current.newsCount) ||
            (currentSocialCount > 0 && currentSocialCount !== prevDataRef.current.socialCount) ||
            (currentCandleCount > 0 && currentCandleCount !== prevDataRef.current.candleCount);

        if (hasNewData && (prevDataRef.current.newsCount !== 0 || prevDataRef.current.socialCount !== 0 || prevDataRef.current.candleCount !== 0)) {
            console.log('New market data detected, recomputing indicators and triggering automatic AI analysis...');
            
            // Recompute fresh indicators from the current candle data
            let freshLatestValues = lastAdviceContext.latestValues;
            if (candles.length >= 26) {
                const ohlcvData: OHLCV[] = candles.map(c => ({
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                    volume: c.volume || 0,
                    timestamp: new Date(c.time).getTime(),
                }));
                const allInds = calculateAllIndicators(ohlcvData);
                freshLatestValues = {
                    ma5: allInds.sma5,
                    ma20: allInds.sma20,
                    ma60: allInds.sma60,
                    ema12: allInds.ema12,
                    ema26: allInds.ema26,
                    bb: allInds.bollinger,
                    macd: { MACD: allInds.macd.value, signal: allInds.macd.signal, histogram: allInds.macd.histogram },
                    rsi: allInds.rsi14,
                    kd: allInds.stochastic,
                };
            }
            
            triggerAIAnalysis(lastAdviceContext.symbol, lastAdviceContext.inds, freshLatestValues, true);
        }
        
        prevDataRef.current = { newsCount: currentNewsCount, socialCount: currentSocialCount, candleCount: currentCandleCount };
    }, [newsArticles, socialPosts, candles, showAIAnalysis, lastAdviceContext, triggerAIAnalysis]);

    const formatMessageWithRiskLabels = (content: string) => {
        const parts = content.split(/(高風險|極高風險|警告|盲點|可信|安全|低風險|中風險)/g);
        return parts.map((part, i) => {
            if (/高風險|極高風險|警告|盲點/.test(part)) {
                return <span key={i} className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold border border-red-500/30">{part}</span>;
            } else if (/可信|安全|低風險/.test(part)) {
                return <span key={i} className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">{part}</span>;
            } else if (/中風險/.test(part)) {
                return <span key={i} className="bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-bold border border-yellow-500/30">{part}</span>;
            }
            return part;
        });
    };

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
                                            <tr 
                                                key={quote.symbol} 
                                                className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                                                onClick={() => setSelectedSymbol(quote.symbol)}
                                            >
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
                                                        onClick={(e) => { e.stopPropagation(); handleAddToWatchlist(quote.symbol); }}
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

            <Dialog open={!!selectedSymbol} onOpenChange={(open) => {
                if (!open) {
                    setSelectedSymbol(null);
                    setShowAIAnalysis(false);
                }
            }}>
                <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pr-8 gap-4">
                            <DialogTitle className="text-2xl">{selectedSymbol} - 技術分析</DialogTitle>
                            
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center space-x-1 bg-muted/50 p-1 rounded-lg">
                                    {(['1M', '3M', '6M', '1Y', 'YTD', '5Y'] as const).map(range => (
                                        <Button
                                            key={range}
                                            variant={timeRange === range ? "default" : "ghost"}
                                            size="sm"
                                            className="h-7 text-xs px-2"
                                            onClick={() => setTimeRange(range)}
                                        >
                                            {range}
                                        </Button>
                                    ))}
                                </div>
                                <div className="flex items-center space-x-1 bg-muted/50 p-1 rounded-lg">
                                    <Button
                                        variant={indicators.ma ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, ma: !prev.ma }))}
                                    >
                                        均線 (MA)
                                    </Button>
                                    <Button
                                        variant={indicators.ema ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, ema: !prev.ema }))}
                                    >
                                        EMA
                                    </Button>
                                    <Button
                                        variant={indicators.bb ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, bb: !prev.bb }))}
                                    >
                                        布林通道
                                    </Button>
                                    <Button
                                        variant={indicators.macd ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, macd: !prev.macd }))}
                                    >
                                        MACD
                                    </Button>
                                    <Button
                                        variant={indicators.rsi ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, rsi: !prev.rsi }))}
                                    >
                                        RSI
                                    </Button>
                                    <Button
                                        variant={indicators.kd ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, kd: !prev.kd }))}
                                    >
                                        KD
                                    </Button>
                                    <Button
                                        variant={indicators.srLevels ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, srLevels: !prev.srLevels }))}
                                    >
                                        支撐/壓力
                                    </Button>
                                    <Button
                                        variant={indicators.fibonacci ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, fibonacci: !prev.fibonacci }))}
                                    >
                                        斐波那契
                                    </Button>
                                    <Button
                                        variant={indicators.patterns ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setIndicators(prev => ({ ...prev, patterns: !prev.patterns }))}
                                    >
                                        K線型態
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 w-full mt-4 min-h-0 flex gap-4">
                        {/* Chart Area */}
                        <div className={`transition-all duration-300 ease-in-out ${showAIAnalysis ? 'w-2/3' : 'w-full'} h-full flex flex-col`}>
                            {isCandlesLoading ? (
                                <div className="flex items-center justify-center h-full border rounded-lg bg-background/50">
                                    <span className="text-muted-foreground animate-pulse">載入中...</span>
                                </div>
                            ) : candles.length > 0 ? (
                                <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-background/50 relative">
                                    <CandlestickChart 
                                        data={candles} 
                                        indicators={indicators} 
                                        className="w-full h-full"
                                        symbol={selectedSymbol || undefined}
                                        onGetAdvice={(symbol, inds, latestValues) => {
                                            setShowAIAnalysis(true);
                                            setLastAdviceContext({ symbol, inds, latestValues });
                                            triggerAIAnalysis(symbol, inds, latestValues, false);
                                        }}
                                    />
                                    {showAIAnalysis && (
                                        <div className="absolute top-4 left-4 z-10">
                                            <Button variant="secondary" size="sm" onClick={() => setShowAIAnalysis(false)}>
                                                隱藏 AI 分析
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full border rounded-lg bg-background/50 text-muted-foreground">
                                    暫無歷史資料
                                </div>
                            )}
                        </div>

                        {/* AI Decision Summary Area */}
                        {showAIAnalysis && (
                            <div className="w-1/3 h-full flex flex-col animate-in slide-in-from-right-4 duration-300">
                                <Tabs defaultValue="nova" className="w-full h-full flex flex-col">
                                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-md">
                                        <TabsTrigger value="nova" className="text-xs data-[state=active]:bg-[#D97706]/20 data-[state=active]:text-[#D97706]">
                                            Nova (策略)
                                        </TabsTrigger>
                                        <TabsTrigger value="guardian" className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-500">
                                            Guardian (風險)
                                        </TabsTrigger>
                                        <TabsTrigger value="argus" className="text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500">
                                            Argus (情報)
                                        </TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="nova" className="flex-1 min-h-0 mt-2 m-0 data-[state=inactive]:hidden flex flex-col">
                                        <Card className="flex-1 flex flex-col border-[#D97706]/30 shadow-[0_0_15px_rgba(217,119,6,0.1)]">
                                            <CardHeader className="py-3 bg-[#D97706]/10 border-b border-[#D97706]/20">
                                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-[#D97706]">
                                                    <Activity className="w-4 h-4" />
                                                    Nova 策略分析 (Strategy)
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex-1 overflow-y-auto p-4 bg-[#121212]/80 space-y-4">
                                                {chatHistory['nova']?.slice(-2).map((msg) => (
                                                    msg.sender === 'agent' && (
                                                        <div key={msg.id} className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                                                            {formatMessageWithRiskLabels(msg.content)}
                                                        </div>
                                                    )
                                                ))}
                                                {agentTypingStatus['nova'] && (
                                                    <div className="flex items-center gap-2 text-sm font-mono text-[#D97706] animate-pulse">
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        {agentTypingStatus['nova']}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="guardian" className="flex-1 min-h-0 mt-2 m-0 data-[state=inactive]:hidden flex flex-col">
                                        <Card className="flex-1 flex flex-col border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                            <CardHeader className="py-3 bg-blue-500/10 border-b border-blue-500/20">
                                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-500">
                                                    <ShieldAlert className="w-4 h-4" />
                                                    Guardian 風險控管 (Risk)
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex-1 overflow-y-auto p-4 bg-[#121212]/80 space-y-4">
                                                {chatHistory['guardian']?.slice(-2).map((msg) => (
                                                    msg.sender === 'agent' && (
                                                        <div key={msg.id} className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                                                            {formatMessageWithRiskLabels(msg.content)}
                                                        </div>
                                                    )
                                                ))}
                                                {agentTypingStatus['guardian'] && (
                                                    <div className="flex items-center gap-2 text-sm font-mono text-blue-500 animate-pulse">
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        {agentTypingStatus['guardian']}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="argus" className="flex-1 min-h-0 mt-2 m-0 data-[state=inactive]:hidden flex flex-col">
                                        <Card className="flex-1 flex flex-col border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                            <CardHeader className="py-3 bg-emerald-500/10 border-b border-emerald-500/20">
                                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-500">
                                                    <Search className="w-4 h-4" />
                                                    Argus 資訊驗證 (OSINT)
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex-1 overflow-y-auto p-4 bg-[#121212]/80 space-y-4">
                                                {chatHistory['argus']?.slice(-2).map((msg) => (
                                                    msg.sender === 'agent' && (
                                                        <div key={msg.id} className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                                                            {formatMessageWithRiskLabels(msg.content)}
                                                        </div>
                                                    )
                                                ))}
                                                {agentTypingStatus['argus'] && (
                                                    <div className="flex items-center gap-2 text-sm font-mono text-emerald-500 animate-pulse">
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        {agentTypingStatus['argus']}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
