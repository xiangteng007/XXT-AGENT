"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSignal = generateSignal;
exports.getActiveSignals = getActiveSignals;
exports.formatSignalForTelegram = formatSignalForTelegram;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const local_inference_service_1 = require("../local-inference.service");
const memory_store_service_1 = require("../memory-store.service");
const macro_data_service_1 = require("./macro-data.service");
const fundamental_data_service_1 = require("./fundamental-data.service");
const osint_scanner_service_1 = require("./osint-scanner.service");
const quant_engine_service_1 = require("./quant-engine.service");
const monte_carlo_service_1 = require("./monte-carlo.service");
const db = (0, firestore_1.getFirestore)();
function getDynamicWeights(vix, isEarningsSeason) {
    // Base weights
    let w = { neural: 0.35, quant: 0.30, sentiment: 0.20, macro: 0.15 };
    // High VIX: rely more on quant (less emotional)
    if (vix > 30) {
        w = { neural: 0.25, quant: 0.40, sentiment: 0.15, macro: 0.20 };
    }
    // Earnings season: fundamentals matter more (adjust via neural context)
    if (isEarningsSeason) {
        w = { ...w, neural: w.neural + 0.10, sentiment: w.sentiment - 0.10 };
    }
    return w;
}
// ─────────────────────────────────────────
// Neural Vote (Ollama)
// ─────────────────────────────────────────
const NEURAL_SYSTEM = `你是量化交易分析師。根據提供的技術指標和市場數據，做出方向性預測。

輸出 JSON（單一物件）：
{"vote":"BULLISH|BEARISH|NEUTRAL","confidence":0-100,"entryZone":[下限,上限],"target":目標價,"stop":止損價,"reason":"一句話理由（繁體中文）"}

規則：
- confidence < 55 時請輸出 NEUTRAL
- 只輸出 JSON，不要其他文字`;
async function getNeuralVote(symbol, currentPrice, contextParts) {
    if (!await (0, local_inference_service_1.isOllamaAvailable)()) {
        return { vote: 'NEUTRAL', confidence: 0, reason: 'Ollama 離線' };
    }
    const input = [
        `標的：${symbol}，當前價格：${currentPrice}`,
        ...contextParts,
    ].join('\n\n');
    try {
        const raw = await (0, local_inference_service_1.ollamaGenerate)(input, NEURAL_SYSTEM, 'qwen3:14b', {
            temperature: 0.2,
            num_predict: 512,
        });
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
            vote: parsed.vote ?? 'NEUTRAL',
            confidence: Math.min(100, Math.max(0, parsed.confidence ?? 50)),
            reason: parsed.reason ?? '',
        };
    }
    catch {
        return { vote: 'NEUTRAL', confidence: 0, reason: 'LLM 解析失敗' };
    }
}
// ─────────────────────────────────────────
// Vote Aggregation
// ─────────────────────────────────────────
function aggregateVotes(votes, weights) {
    const voteToScore = (v) => v === 'BULLISH' ? 1 : v === 'BEARISH' ? -1 : 0;
    const voteEntries = [
        { key: 'neural', weight: weights.neural },
        { key: 'quant', weight: weights.quant },
        { key: 'sentiment', weight: weights.sentiment },
        { key: 'macro', weight: weights.macro },
    ];
    let weightedScore = 0;
    let totalConfidence = 0;
    let totalWeight = 0;
    for (const { key, weight } of voteEntries) {
        const model = votes[key];
        const score = voteToScore(model.vote);
        weightedScore += score * weight * (model.confidence / 100);
        totalConfidence += model.confidence * weight;
        totalWeight += weight;
    }
    const avgConfidence = Math.round(totalConfidence / totalWeight);
    let direction = 'NEUTRAL';
    if (weightedScore >= 0.2)
        direction = 'LONG';
    if (weightedScore <= -0.2)
        direction = 'SHORT';
    return { direction, confidence: avgConfidence, weightedScore };
}
// ─────────────────────────────────────────
// Price targets
// ─────────────────────────────────────────
function calculateTargets(currentPrice, direction, atr, // Average True Range
rrRatio = 2.5) {
    const entryPrice = currentPrice;
    const stopDistance = atr * 1.5;
    let stopLoss;
    let targetPrice;
    if (direction === 'LONG') {
        stopLoss = entryPrice - stopDistance;
        targetPrice = entryPrice + stopDistance * rrRatio;
    }
    else if (direction === 'SHORT') {
        stopLoss = entryPrice + stopDistance;
        targetPrice = entryPrice - stopDistance * rrRatio;
    }
    else {
        stopLoss = entryPrice * 0.95;
        targetPrice = entryPrice * 1.05;
    }
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(targetPrice - entryPrice);
    const riskReward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;
    return {
        entryPrice: Math.round(entryPrice * 100) / 100,
        targetPrice: Math.round(targetPrice * 100) / 100,
        stopLoss: Math.round(stopLoss * 100) / 100,
        riskReward,
    };
}
/** Calculate ATR (Average True Range) */
function calcATR(candles, period = 14) {
    if (candles.length < 2)
        return (candles[0]?.close ?? 0) * 0.02 || 1;
    const trs = candles.slice(1).map((c, i) => {
        const prev = candles[i].close;
        return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
    });
    const recent = trs.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
}
// ─────────────────────────────────────────
// Main signal generator
// ─────────────────────────────────────────
async function generateSignal(req) {
    v2_1.logger.info(`[SignalGen] Generating signal for ${req.symbol} @ ${req.currentPrice}`);
    const { symbol, currentPrice, candles } = req;
    // ── Parallel data fetch ──
    const [macro, fundamental, sentiment] = await Promise.all([
        (0, macro_data_service_1.fetchMacroSnapshot)(),
        (0, fundamental_data_service_1.fetchFundamentalSnapshot)(symbol),
        (0, osint_scanner_service_1.runOsintScan)(symbol),
    ]);
    const regime = (0, macro_data_service_1.classifyMacroRegime)(macro);
    const quant = (0, quant_engine_service_1.calculateQuantMetrics)(symbol, candles);
    // ── Monte Carlo ──
    const mc = (0, monte_carlo_service_1.runMonteCarlo)({
        symbol,
        currentPrice,
        annualizedVolatility: quant.realizedVol,
        annualizedDrift: quant.drift * 12, // monthly → annual approx
        horizonDays: 5,
        simulations: 10_000,
    });
    // ── Build context for Neural vote ──
    const contextParts = [
        (0, quant_engine_service_1.formatQuantForPrompt)(quant),
        (0, macro_data_service_1.formatMacroForPrompt)(macro, regime),
        (0, osint_scanner_service_1.formatSentimentForPrompt)(sentiment),
        (0, fundamental_data_service_1.formatFundamentalForPrompt)(fundamental),
        (0, monte_carlo_service_1.formatMonteCarloForPrompt)(mc),
    ];
    // ── Neural vote ──
    const neuralVote = await getNeuralVote(symbol, currentPrice, contextParts);
    // ── Quant vote ──
    const quantVote = {
        vote: quant.quantSignal.includes('BUY') ? 'BULLISH' :
            quant.quantSignal.includes('SELL') ? 'BEARISH' : 'NEUTRAL',
        confidence: Math.abs(quant.quantScore),
        reason: `Hurst=${quant.hurstExponent.toFixed(2)}, Drift=${quant.drift > 0 ? '+' : ''}${quant.drift.toFixed(2)}%`,
    };
    // ── Sentiment vote ──
    const sentimentVote = {
        vote: sentiment.overallScore >= 20 ? 'BULLISH' :
            sentiment.overallScore <= -20 ? 'BEARISH' : 'NEUTRAL',
        confidence: Math.min(100, Math.abs(sentiment.overallScore)),
        reason: `情緒分數 ${sentiment.overallScore > 0 ? '+' : ''}${sentiment.overallScore}`,
    };
    // ── Macro vote ──
    const macroVote = {
        vote: regime.riskMode === 'RISK_ON' ? 'BULLISH' :
            regime.riskMode === 'RISK_OFF' ? 'BEARISH' : 'NEUTRAL',
        confidence: regime.riskMode === 'NEUTRAL' ? 40 : 70,
        reason: regime.description,
    };
    const votes = {
        neural: neuralVote,
        quant: quantVote,
        sentiment: sentimentVote,
        macro: macroVote,
    };
    // ── Aggregate ──
    const isEarningsSeason = new Date().getMonth() % 3 === 0; // Q1/Q2/Q3/Q4 start months
    const weights = getDynamicWeights(macro.vix, isEarningsSeason);
    const { direction, confidence, weightedScore } = aggregateVotes(votes, weights);
    v2_1.logger.info(`[SignalGen] ${symbol} direction=${direction} confidence=${confidence} score=${weightedScore.toFixed(3)}`);
    // ── Apply confidence penalty for high VIX ──
    const adjustedConfidence = macro.vix > 30
        ? Math.round(confidence * 0.75)
        : confidence;
    // ── Skip if NEUTRAL or low confidence ──
    if (direction === 'NEUTRAL' || adjustedConfidence < 55) {
        v2_1.logger.info(`[SignalGen] Signal below threshold, skipping (dir=${direction}, conf=${adjustedConfidence}%)`);
        return null;
    }
    // ── Price targets ──
    const atr = calcATR(candles);
    const targets = calculateTargets(currentPrice, direction, atr, req.targetMultiplier ?? 2.5);
    // ── Skip if R/R < 2.5 ──
    if (targets.riskReward < 2.5) {
        v2_1.logger.info(`[SignalGen] R/R ${targets.riskReward} below threshold, skipping`);
        return null;
    }
    // ── Generate Ollama rationale ──
    let rationale = '訊號生成完成';
    if (await (0, local_inference_service_1.isOllamaAvailable)()) {
        try {
            const summaryPrompt = [
                `你是首席量化分析師，用120字以內的繁體中文解釋以下交易訊號：`,
                `標的：${symbol} | 方向：${direction} | 信心：${adjustedConfidence}%`,
                `入場：$${targets.entryPrice} | 目標：$${targets.targetPrice} | 止損：$${targets.stopLoss}`,
                `模型投票：Neural=${votes.neural.vote}(${votes.neural.confidence}%) Quant=${votes.quant.vote}(${votes.quant.confidence}%) 情緒=${votes.sentiment.vote} 總經=${votes.macro.vote}`,
                `蒙特卡洛上漲機率：${mc.upProbability}%`,
            ].join('\n');
            rationale = await (0, local_inference_service_1.ollamaGenerate)(summaryPrompt, '你是量化分析師，用繁體中文解釋訊號邏輯。', 'qwen3:14b', {
                temperature: 0.3,
                num_predict: 300,
            });
        }
        catch {
            rationale = `${symbol} ${direction}訊號：${votes.neural.reason}`;
        }
    }
    // ── Build signal ──
    const signalId = `${symbol}_${Date.now()}`;
    const signal = {
        id: signalId,
        symbol,
        timestamp: new Date(),
        direction,
        ...targets,
        confidence: adjustedConfidence,
        votes,
        rationale: rationale.trim(),
        validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
        monteCarlo: {
            upProb: mc.upProbability,
            ci95: mc.ci95,
            expectedMaxDrawdown: mc.expectedMaxDrawdown,
        },
        status: 'ACTIVE',
    };
    // ── Persist to Firestore ──
    await db.collection('mpe_signals').doc(signalId).set({
        ...signal,
        timestamp: firestore_1.Timestamp.fromDate(signal.timestamp),
        validUntil: firestore_1.Timestamp.fromDate(signal.validUntil),
        monteCarlo: signal.monteCarlo,
    });
    // ── Persist to ChromaDB for future RAG ──
    await (0, memory_store_service_1.saveMemory)({
        userId: 'system',
        agentId: 'mpe',
        content: `[MPE訊號] ${symbol} ${direction} @${targets.entryPrice} 目標${targets.targetPrice} 止損${targets.stopLoss} R/R=${targets.riskReward} 信心${adjustedConfidence}%\n${rationale}`,
        type: 'fact',
        importance: 4,
        tags: ['MPE', '訊號', symbol, direction, new Date().toISOString().slice(0, 10)],
    }).catch(() => { });
    v2_1.logger.info(`[SignalGen] Signal created: ${signalId} R/R=${targets.riskReward} conf=${adjustedConfidence}%`);
    return signal;
}
// ─────────────────────────────────────────
// Query active signals
// ─────────────────────────────────────────
async function getActiveSignals(symbol) {
    let query = db.collection('mpe_signals')
        .where('status', '==', 'ACTIVE')
        .where('validUntil', '>', firestore_1.Timestamp.now())
        .orderBy('validUntil', 'desc')
        .limit(10);
    if (symbol) {
        query = db.collection('mpe_signals')
            .where('symbol', '==', symbol)
            .where('status', '==', 'ACTIVE')
            .orderBy('timestamp', 'desc')
            .limit(5);
    }
    const snap = await query.get();
    return snap.docs.map(d => {
        const data = d.data();
        return {
            ...data,
            timestamp: data.timestamp.toDate(),
            validUntil: data.validUntil.toDate(),
        };
    });
}
// ─────────────────────────────────────────
// Telegram message formatter
// ─────────────────────────────────────────
function formatSignalForTelegram(s) {
    const emoji = s.direction === 'LONG' ? '🟢' : s.direction === 'SHORT' ? '🔴' : '⚪';
    const voteStr = Object.entries(s.votes)
        .map(([k, v]) => `${k}:${v.vote[0]}(${v.confidence}%)`)
        .join(' ');
    const lines = [
        `${emoji} **MPE 訊號 — ${s.symbol}**`,
        `方向：${s.direction} | 信心：${s.confidence}%`,
        ``,
        `📊 入場：\`$${s.entryPrice.toFixed(2)}\``,
        `🎯 目標：\`$${s.targetPrice.toFixed(2)}\``,
        `🛑 止損：\`$${s.stopLoss.toFixed(2)}\``,
        `📐 R/R：${s.riskReward}`,
        ``,
        `🤖 模型投票：${voteStr}`,
    ];
    if (s.monteCarlo) {
        lines.push(`🎲 蒙特卡洛：上漲${s.monteCarlo.upProb}% | 最大回撤${s.monteCarlo.expectedMaxDrawdown}%`);
    }
    lines.push(``, `💬 ${s.rationale}`, ``, `⏱ 有效至：${s.validUntil.toLocaleTimeString('zh-TW')}`);
    return lines.join('\n');
}
//# sourceMappingURL=signal-generator.service.js.map