// AI-powered investment analysis using Gemini

import { generateJSON, generateText, streamText } from './gemini-client';
import type { MarketQuote } from '@/lib/api/types';
import type { FusedEvent } from '@/lib/api/types';
import type { Position, Portfolio } from '@/lib/types/portfolio';
import type { TechnicalIndicators } from '@/lib/indicators/technical';

// Analysis result types
export interface StockAnalysis {
    symbol: string;
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    confidence: number;
    targetPrice?: number;
    stopLoss?: number;
    timeHorizon: 'short' | 'medium' | 'long';
    summary: string;
    bullishFactors: string[];
    bearishFactors: string[];
    riskLevel: 'low' | 'medium' | 'high';
}

export interface NewsImpactAnalysis {
    eventId: string;
    impactScore: number;  // -100 to 100
    affectedSymbols: string[];
    timeToImpact: 'immediate' | 'short_term' | 'long_term';
    tradingImplication: string;
    confidenceLevel: number;
}

export interface PortfolioAdvice {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    riskAssessment: string;
    diversificationScore: number;
    recommendations: {
        action: 'increase' | 'decrease' | 'hold' | 'exit';
        symbol: string;
        reason: string;
        priority: 'high' | 'medium' | 'low';
    }[];
    rebalancingSuggestions: string[];
}

export interface MarketOutlook {
    sentiment: 'bullish' | 'bearish' | 'neutral';
    keyDrivers: string[];
    sectors: {
        name: string;
        outlook: 'positive' | 'negative' | 'neutral';
        reason: string;
    }[];
    risks: string[];
    opportunities: string[];
}

/**
 * Analyze a stock based on price, technicals, and news
 */
export async function analyzeStock(
    quote: MarketQuote,
    indicators: TechnicalIndicators,
    recentNews: FusedEvent[]
): Promise<StockAnalysis> {
    const prompt = `
作為專業投資分析師，請分析以下標的：

## 標的資訊
- 代號: ${quote.symbol}
- 名稱: ${quote.name}
- 類型: ${quote.type}
- 現價: $${quote.lastPrice}
- 漲跌: ${quote.changePct > 0 ? '+' : ''}${quote.changePct.toFixed(2)}%
- 成交量: ${quote.volume.toLocaleString()}

## 技術指標
- RSI(14): ${indicators.rsi14.toFixed(1)}
- MACD: ${indicators.macd.value.toFixed(2)} (Signal: ${indicators.macd.signal.toFixed(2)})
- 布林通道: 上軌 ${indicators.bollinger.upper.toFixed(2)}, 中軌 ${indicators.bollinger.middle.toFixed(2)}, 下軌 ${indicators.bollinger.lower.toFixed(2)}
- SMA20: ${indicators.sma20.toFixed(2)}, SMA60: ${indicators.sma60.toFixed(2)}
- 趨勢強度: ${indicators.trendStrength}

## 近期新聞 (${recentNews.length} 則)
${recentNews.slice(0, 5).map(n => `- [${n.sentiment || 'neutral'}] ${n.news_title}`).join('\n')}

請提供 JSON 格式的分析結果，包含：
- recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell"
- confidence: 0-100 的信心度
- targetPrice: 目標價 (可選)
- stopLoss: 建議停損價 (可選)
- timeHorizon: "short" | "medium" | "long"
- summary: 一句話總結
- bullishFactors: 利多因素陣列
- bearishFactors: 利空因素陣列
- riskLevel: "low" | "medium" | "high"
`;

    return generateJSON<StockAnalysis>(prompt);
}

/**
 * Analyze news impact on market
 */
export async function analyzeNewsImpact(
    event: FusedEvent,
    relatedQuotes: MarketQuote[]
): Promise<NewsImpactAnalysis> {
    const prompt = `
分析以下新聞事件對市場的影響：

## 新聞內容
- 標題: ${event.news_title}
- 嚴重度: ${event.severity}
- 情緒: ${event.sentiment || 'unknown'}
- 影響假設: ${event.impact_hypothesis?.join(', ') || 'N/A'}

## 相關標的
${relatedQuotes.map(q => `- ${q.symbol}: $${q.lastPrice} (${q.changePct > 0 ? '+' : ''}${q.changePct.toFixed(2)}%)`).join('\n')}

請提供 JSON 格式的分析：
- impactScore: -100 到 100 的影響分數 (負數為利空)
- affectedSymbols: 受影響的標的代號陣列
- timeToImpact: "immediate" | "short_term" | "long_term"
- tradingImplication: 交易建議說明
- confidenceLevel: 0-100 的信心度
`;

    const result = await generateJSON<NewsImpactAnalysis>(prompt);
    return { ...result, eventId: event.id };
}

/**
 * Get portfolio advice
 */
export async function getPortfolioAdvice(
    portfolio: Portfolio
): Promise<PortfolioAdvice> {
    const positionsSummary = portfolio.positions.map(p =>
        `${p.symbol}: ${p.quantity}股 @ $${p.avgCost.toFixed(2)}, 現價 $${p.currentPrice.toFixed(2)}, ` +
        `損益 ${p.unrealizedPnLPct >= 0 ? '+' : ''}${p.unrealizedPnLPct.toFixed(1)}%, 佔比 ${p.weight.toFixed(1)}%`
    ).join('\n');

    const prompt = `
作為專業投資顧問，請審視以下投資組合：

## 組合概況
- 總市值: $${portfolio.totalValue.toLocaleString()}
- 總損益: ${portfolio.totalPnLPct >= 0 ? '+' : ''}${portfolio.totalPnLPct.toFixed(2)}%
- 持倉數: ${portfolio.positions.length}
- 現金: $${portfolio.cashBalance.toLocaleString()}

## 風險指標
- Sharpe Ratio: ${portfolio.riskMetrics.sharpeRatio.toFixed(2)}
- 最大回撤: ${(portfolio.riskMetrics.maxDrawdown * 100).toFixed(1)}%
- Beta: ${portfolio.riskMetrics.beta.toFixed(2)}
- 前5持倉佔比: ${(portfolio.riskMetrics.top5Weight * 100).toFixed(1)}%

## 持倉明細
${positionsSummary}

請提供 JSON 格式的建議：
- overallHealth: "excellent" | "good" | "fair" | "poor"
- riskAssessment: 風險評估說明
- diversificationScore: 0-100 分散度評分
- recommendations: 陣列，每項包含 action, symbol, reason, priority
- rebalancingSuggestions: 再平衡建議字串陣列
`;

    return generateJSON<PortfolioAdvice>(prompt);
}

/**
 * Get market outlook
 */
export async function getMarketOutlook(
    recentEvents: FusedEvent[],
    majorQuotes: MarketQuote[]
): Promise<MarketOutlook> {
    const prompt = `
根據以下市場資訊，提供市場展望分析：

## 主要指數/標的
${majorQuotes.map(q => `- ${q.symbol}: $${q.lastPrice} (${q.changePct > 0 ? '+' : ''}${q.changePct.toFixed(2)}%)`).join('\n')}

## 近期重要事件 (${recentEvents.length} 則)
${recentEvents.slice(0, 10).map(e => `- [${e.severity}分] ${e.news_title}`).join('\n')}

請提供 JSON 格式的市場展望：
- sentiment: "bullish" | "bearish" | "neutral"
- keyDrivers: 主要驅動因素陣列
- sectors: 產業展望陣列，每項包含 name, outlook, reason
- risks: 風險因素陣列
- opportunities: 機會陣列
`;

    return generateJSON<MarketOutlook>(prompt);
}

/**
 * Natural language query for investment questions
 */
export async function askInvestmentQuestion(
    question: string,
    context?: {
        portfolio?: Portfolio;
        watchlist?: MarketQuote[];
        recentNews?: FusedEvent[];
    }
): Promise<string> {
    let contextInfo = '';

    if (context?.portfolio) {
        contextInfo += `\n用戶持有 ${context.portfolio.positions.length} 個持倉，總市值 $${context.portfolio.totalValue.toLocaleString()}`;
    }
    if (context?.watchlist) {
        contextInfo += `\n關注標的: ${context.watchlist.map(q => q.symbol).join(', ')}`;
    }
    if (context?.recentNews) {
        contextInfo += `\n近期有 ${context.recentNews.length} 則相關新聞`;
    }

    const prompt = `
你是一位專業的投資顧問 AI，請回答用戶的投資問題。
${contextInfo}

用戶問題: ${question}

請提供專業、客觀的回答。如果涉及具體投資建議，請加上風險提示。
`;

    return generateText(prompt);
}

/**
 * Stream investment analysis (for real-time display)
 */
export async function* streamAnalysis(
    symbol: string,
    context: string
): AsyncGenerator<string> {
    const prompt = `
對 ${symbol} 進行即時分析。

背景資訊:
${context}

請提供詳細的技術面與基本面分析，分段說明。
`;

    yield* streamText(prompt);
}
