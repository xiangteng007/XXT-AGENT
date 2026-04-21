/**
 * Investment Route — OpenClaw Gateway → Investment Brain Proxy
 *
 * Proxies investment analysis requests to the LangGraph-based
 * Investment Brain service, and broadcasts results via WebSocket.
 *
 * Endpoints:
 *   POST /invest/analyze      → Full analysis pipeline
 *   GET  /invest/status/:id   → Session status
 *   GET  /invest/portfolio    → Virtual portfolio
 *   GET  /invest/sessions     → List sessions
 */

import { Router, Request, Response } from 'express';
import { broadcastEvent } from '../ws-manager';
import { logger } from '../logger';
import { EventType } from '@xxt-agent/types';
import type { InvestBrainAnalyzeRequest, InvestBrainAnalyzeResponse } from '@xxt-agent/types';

export const investRouter = Router();

// C-02: Shared symbol validation — mirrors agents.ts KNOWN_SYMBOLS logic
const SYMBOL_PATTERN = /^[A-Z0-9]{1,10}(\.[A-Z]{1,4})?$/;
const NON_SYMBOL_WORDS = new Set(['BUY', 'SELL', 'HOLD', 'RISK', 'LOW', 'HIGH']);

function isValidSymbol(s: string): boolean {
    const upper = s.toUpperCase().trim();
    return SYMBOL_PATTERN.test(upper) && !NON_SYMBOL_WORDS.has(upper);
}

// Investment Brain URL (same machine or Cloud Run)
const INVESTMENT_BRAIN_URL = process.env['INVESTMENT_BRAIN_URL'] ?? 'http://localhost:8090';
const FETCH_TIMEOUT_MS = 90_000; // 90s — LangGraph pipelines can take time

// ── POST /invest/analyze ──────────────────────────────────
investRouter.post('/analyze', async (req: Request, res: Response) => {
    const { symbol, timeframe = '1h', risk_level = 'moderate', user_context } = req.body as InvestBrainAnalyzeRequest;

    if (!symbol) {
        res.status(400).json({ error: 'symbol is required' });
        return;
    }

    // C-02: Whitelist validation before forwarding to Investment Brain
    const normalizedSymbol = String(symbol).toUpperCase().trim();
    if (!isValidSymbol(normalizedSymbol)) {
        logger.warn(`[Invest] Rejected invalid symbol: "${symbol}"`);
        res.status(400).json({
            error: 'Invalid symbol format',
            detail: 'Symbol must be 1-10 uppercase letters/digits (e.g. AAPL, 2330.TW)',
        });
        return;
    }

    logger.info(`[Invest] Analyze request: ${normalizedSymbol} (risk=${risk_level})`);

    // Broadcast analysis start event
    broadcastEvent({
        id: crypto.randomUUID(),
        type: EventType.INVESTMENT_ANALYSIS_START,
        source: 'openclaw-gateway',
        severity: 'info',
        payload: {
            task_type: 'investment_analysis',
            symbol: symbol.toUpperCase(),
            risk_level,
            timeframe,
        },
        timestamp: new Date().toISOString(),
    });

    try {
        const response = await fetch(`${INVESTMENT_BRAIN_URL}/invest/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // A-05: Service-to-service auth secret
                'X-Internal-Secret': process.env['INTERNAL_SECRET'] ?? '',
            },
            body: JSON.stringify({ symbol: normalizedSymbol, timeframe, risk_level, user_context }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (!response.ok) {
            const errBody = await response.text();
            logger.warn(`[Invest] Brain returned ${response.status}: ${errBody}`);
            res.status(response.status).json({ error: errBody });
            return;
        }

        const result = await response.json() as InvestBrainAnalyzeResponse;

        // Broadcast completion via WebSocket
        broadcastEvent({
            id: crypto.randomUUID(),
            type: EventType.INVESTMENT_ANALYSIS_COMPLETE,
            source: 'investment-brain',
            severity: 'info',
            payload: {
                task_type: 'investment_analysis_complete',
                symbol: symbol.toUpperCase(),
                session_id: result.session_id,
                status: result.status,
                market_insight: result.market_insight,
                investment_plan: result.investment_plan,
                risk_assessment: result.risk_assessment,
            },
            timestamp: new Date().toISOString(),
        });

        logger.info(`[Invest] Analysis complete: ${symbol} (session=${result.session_id?.slice(0, 8)})`);
        res.json(result);

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[Invest] Analysis failed: ${msg}`);
        res.status(502).json({
            error: 'Investment Brain service unavailable',
            detail: msg,
        });
    }
});

// ── POST /invest/analyze/stream (F-06: SSE Proxy) ─────────
investRouter.post('/analyze/stream', async (req: Request, res: Response) => {
    const { symbol, timeframe = '1h', risk_level = 'moderate', user_context } = req.body as InvestBrainAnalyzeRequest;

    if (!symbol) {
        res.status(400).json({ error: 'symbol is required' });
        return;
    }

    const normalizedSymbol = String(symbol).toUpperCase().trim();
    if (!isValidSymbol(normalizedSymbol)) {
        logger.warn(`[Invest/SSE] Rejected invalid symbol: "${symbol}"`);
        res.status(400).json({ error: 'Invalid symbol format' });
        return;
    }

    logger.info(`[Invest/SSE] Stream request: ${normalizedSymbol} (risk=${risk_level})`);

    // Broadcast analysis start via WebSocket
    broadcastEvent({
        id: crypto.randomUUID(),
        type: EventType.INVESTMENT_ANALYSIS_START,
        source: 'openclaw-gateway',
        severity: 'info',
        payload: {
            task_type: 'investment_analysis',
            symbol: normalizedSymbol,
            risk_level,
            timeframe,
            streaming: true,
        },
        timestamp: new Date().toISOString(),
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');  // Disable Nginx buffering
    res.flushHeaders();

    try {
        const brainResponse = await fetch(`${INVESTMENT_BRAIN_URL}/invest/analyze/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': process.env['INTERNAL_SECRET'] ?? '',
            },
            body: JSON.stringify({ symbol: normalizedSymbol, timeframe, risk_level, user_context }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (!brainResponse.ok || !brainResponse.body) {
            const errText = await brainResponse.text().catch(() => 'Unknown error');
            res.write(`event: error\ndata: ${JSON.stringify({ detail: errText })}\n\n`);
            res.end();
            return;
        }

        // Stream Brain's SSE events to the client and broadcast progress via WebSocket
        const reader = brainResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer for WebSocket broadcasting
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';  // Keep incomplete line in buffer

            let currentEvent = '';
            let currentData = '';

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    currentData = line.slice(6);
                } else if (line === '' && currentEvent && currentData) {
                    // Forward to SSE client
                    res.write(`event: ${currentEvent}\ndata: ${currentData}\n\n`);

                    // Broadcast node-level progress events via WebSocket
                    try {
                        const parsed = JSON.parse(currentData);

                        if (currentEvent === 'node_start' || currentEvent === 'node_complete') {
                            broadcastEvent({
                                id: crypto.randomUUID(),
                                type: EventType.INVESTMENT_ANALYSIS_PROGRESS,
                                source: 'investment-brain',
                                severity: 'info',
                                payload: {
                                    task_type: `investment_${currentEvent}`,
                                    symbol: normalizedSymbol,
                                    node: parsed.node,
                                    display: parsed.display,
                                    phase: currentEvent,
                                },
                                timestamp: new Date().toISOString(),
                            });
                        } else if (currentEvent === 'graph_complete') {
                            broadcastEvent({
                                id: crypto.randomUUID(),
                                type: EventType.INVESTMENT_ANALYSIS_COMPLETE,
                                source: 'investment-brain',
                                severity: 'info',
                                payload: {
                                    task_type: 'investment_analysis_complete',
                                    symbol: normalizedSymbol,
                                    session_id: parsed.session_id,
                                    status: parsed.status,
                                    market_insight: parsed.market_insight,
                                    investment_plan: parsed.investment_plan,
                                    risk_assessment: parsed.risk_assessment,
                                },
                                timestamp: new Date().toISOString(),
                            });
                        }
                    } catch {
                        // JSON parse failure — non-critical, just skip WS broadcast
                    }

                    currentEvent = '';
                    currentData = '';
                }
            }
        }

        logger.info(`[Invest/SSE] Stream complete: ${normalizedSymbol}`);
        res.end();

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[Invest/SSE] Stream failed: ${msg}`);
        res.write(`event: error\ndata: ${JSON.stringify({ detail: msg })}\n\n`);
        res.end();
    }
});

// ── GET /invest/status/:sessionId ─────────────────────────
investRouter.get('/status/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    try {
        const response = await fetch(`${INVESTMENT_BRAIN_URL}/invest/status/${sessionId}`, {
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            res.status(response.status).json({ error: 'Session not found' });
            return;
        }

        res.json(await response.json());
    } catch (err) {
        res.status(502).json({ error: 'Investment Brain unavailable' });
    }
});

// ── GET /invest/portfolio ─────────────────────────────────
investRouter.get('/portfolio', async (_req: Request, res: Response) => {
    try {
        const response = await fetch(`${INVESTMENT_BRAIN_URL}/invest/portfolio`, {
            signal: AbortSignal.timeout(5000),
        });
        res.json(await response.json());
    } catch {
        // Fallback: return empty portfolio
        res.json({
            status: 'offline',
            portfolio: {
                total_value: 100000,
                cash: 100000,
                positions: [],
                daily_pnl: 0,
                max_drawdown: 0,
            },
        });
    }
});

// ── GET /invest/sessions ──────────────────────────────────
investRouter.get('/sessions', async (_req: Request, res: Response) => {
    try {
        const response = await fetch(`${INVESTMENT_BRAIN_URL}/invest/sessions`, {
            signal: AbortSignal.timeout(5000),
        });
        res.json(await response.json());
    } catch {
        res.json({ sessions: [], total: 0 });
    }
});

// ── GET /invest/quote ─────────────────────────────────────
investRouter.get('/quote', async (req: Request, res: Response) => {
    const symbol = req.query.symbol as string;
    if (!symbol) {
        res.status(400).json({ error: 'symbol is required' });
        return;
    }
    try {
        const response = await fetch(`${INVESTMENT_BRAIN_URL}/invest/quote?symbol=${encodeURIComponent(symbol)}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            res.status(response.status).json({ error: 'Quote unavailable' });
            return;
        }
        res.json(await response.json());
    } catch (err) {
        res.status(502).json({ error: 'Investment Brain unavailable' });
    }
});

// ── GET /invest/candles ───────────────────────────────────
investRouter.get('/candles', async (req: Request, res: Response) => {
    const symbol = req.query.symbol as string;
    const start = req.query.start as string;
    const end = req.query.end as string;
    
    if (!symbol || !start || !end) {
        res.status(400).json({ error: 'symbol, start, and end are required' });
        return;
    }
    try {
        const response = await fetch(`${INVESTMENT_BRAIN_URL}/invest/candles?symbol=${encodeURIComponent(symbol)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            res.status(response.status).json({ error: 'Candles unavailable' });
            return;
        }
        res.json(await response.json());
    } catch (err) {
        res.status(502).json({ error: 'Investment Brain unavailable' });
    }
});

// ── GET /invest/news ──────────────────────────────────────
investRouter.get('/news', async (req: Request, res: Response) => {
    const symbol = req.query.symbol as string || '';
    
    try {
        const response = await fetch(`${INVESTMENT_BRAIN_URL}/invest/news?symbol=${encodeURIComponent(symbol)}`, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            res.status(response.status).json({ error: 'News unavailable' });
            return;
        }
        res.json(await response.json());
    } catch (err) {
        res.status(502).json({ error: 'Investment Brain unavailable' });
    }
});
