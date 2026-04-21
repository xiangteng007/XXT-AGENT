import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { GATEWAY_URL } from '../../_gateway';

/**
 * POST /api/market/portfolio/stream
 *
 * F-06: SSE Proxy — Streams real-time analysis progress from
 * Investment Brain via OpenClaw Gateway to the Dashboard.
 *
 * The client receives SSE events:
 *   - node_start:      { node, display }
 *   - node_complete:   { node, display }
 *   - graph_complete:  { session_id, status, market_insight, ... }
 *   - error:           { detail }
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return new Response(JSON.stringify({ error: auth.error }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const body = await req.json() as { symbol?: string; action?: string; risk_level?: string };

    if (!body.symbol) {
        return new Response(JSON.stringify({ error: 'symbol is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const upstreamUrl = `${GATEWAY_URL}/invest/analyze/stream`;
        const upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: body.symbol,
                action: body.action ?? 'full_analysis',
                risk_level: body.risk_level ?? 'moderate',
            }),
            signal: AbortSignal.timeout(120_000),  // 2min for LangGraph pipeline
        });

        if (!upstreamRes.ok || !upstreamRes.body) {
            const errText = await upstreamRes.text().catch(() => 'Gateway unreachable');
            return new Response(JSON.stringify({ error: errText }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Pipe the upstream SSE stream directly to the client
        return new Response(upstreamRes.body, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: msg }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
