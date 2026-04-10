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

export const investRouter = Router();

// Investment Brain URL (same machine or Cloud Run)
const INVESTMENT_BRAIN_URL = process.env['INVESTMENT_BRAIN_URL'] ?? 'http://localhost:8090';
const FETCH_TIMEOUT_MS = 90_000; // 90s — LangGraph pipelines can take time

// ── POST /invest/analyze ──────────────────────────────────
investRouter.post('/analyze', async (req: Request, res: Response) => {
    const { symbol, timeframe = '1h', risk_level = 'moderate', user_context } = req.body as {
        symbol: string;
        timeframe?: string;
        risk_level?: string;
        user_context?: string;
    };

    if (!symbol) {
        res.status(400).json({ error: 'symbol is required' });
        return;
    }

    logger.info(`[Invest] Analyze request: ${symbol} (risk=${risk_level})`);

    // Broadcast analysis start event
    broadcastEvent({
        id: crypto.randomUUID(),
        type: EventType.TASK_QUEUED,
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, timeframe, risk_level, user_context }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (!response.ok) {
            const errBody = await response.text();
            logger.warn(`[Invest] Brain returned ${response.status}: ${errBody}`);
            res.status(response.status).json({ error: errBody });
            return;
        }

        const result = await response.json() as Record<string, unknown>;

        // Broadcast completion via WebSocket
        broadcastEvent({
            id: crypto.randomUUID(),
            type: EventType.NEWS_INGESTED, // Reuse existing event type for now
            source: 'investment-brain',
            severity: 'info',
            payload: {
                task_type: 'investment_analysis_complete',
                symbol: symbol.toUpperCase(),
                session_id: result['session_id'],
                status: result['status'],
                market_insight: result['market_insight'],
                investment_plan: result['investment_plan'],
                risk_assessment: result['risk_assessment'],
            },
            timestamp: new Date().toISOString(),
        });

        logger.info(`[Invest] Analysis complete: ${symbol} (session=${String(result['session_id']).slice(0, 8)})`);
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
