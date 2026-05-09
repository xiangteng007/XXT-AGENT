/**
 * Signal Generator Service — 多模型投票訊號引擎
 *
 * 整合四層智能模型的投票結果，產生最終交易訊號：
 *
 *   1. Neural Vote     — Ollama LLM 技術分析預測
 *   2. Quant Vote      — 量化指標 (Hurst/Entropy/Drift)
 *   3. Sentiment Vote  — OSINT 情緒評分
 *   4. Macro Vote      — 總經環境評估
 *
 * 門檻：
 *   - R/R >= 2.5 才推播
 *   - Confidence >= 55% 才推播
 *   - 高波動期（VIX > 30）自動降低信心分數
 *
 * 訊號自動持久化至 Firestore + ChromaDB（供未來 RAG 回顧）
 */
import { type OHLCV } from './quant-engine.service';
type Vote = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
type Direction = 'LONG' | 'SHORT' | 'NEUTRAL';
export interface ModelVotes {
    neural: {
        vote: Vote;
        confidence: number;
        reason: string;
    };
    quant: {
        vote: Vote;
        confidence: number;
        reason: string;
    };
    sentiment: {
        vote: Vote;
        confidence: number;
        reason: string;
    };
    macro: {
        vote: Vote;
        confidence: number;
        reason: string;
    };
}
export interface TradingSignal {
    id: string;
    symbol: string;
    timestamp: Date;
    direction: Direction;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    riskReward: number;
    confidence: number;
    votes: ModelVotes;
    rationale: string;
    validUntil: Date;
    monteCarlo?: {
        upProb: number;
        ci95: [number, number];
        expectedMaxDrawdown: number;
    };
    status: 'ACTIVE' | 'EXPIRED' | 'TRIGGERED' | 'INVALIDATED';
}
export interface SignalRequest {
    symbol: string;
    currentPrice: number;
    candles: OHLCV[];
    targetMultiplier?: number;
}
export declare function generateSignal(req: SignalRequest): Promise<TradingSignal | null>;
export declare function getActiveSignals(symbol?: string): Promise<TradingSignal[]>;
export declare function formatSignalForTelegram(s: TradingSignal): string;
export {};
//# sourceMappingURL=signal-generator.service.d.ts.map