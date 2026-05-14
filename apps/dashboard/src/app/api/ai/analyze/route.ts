import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

/**
 * POST /api/ai/analyze
 * Proxy to AI Gateway for stock analysis.
 * Accepts { symbol, indicators, prompt? } and returns { analysis }.
 */

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || '';

export async function POST(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const body = await req.json();
        const { symbol, indicators, prompt } = body;

        if (!symbol) {
            return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }

        if (!AI_GATEWAY_URL) {
            return NextResponse.json(
                { error: 'AI Gateway not configured', analysis: null },
                { status: 503 }
            );
        }

        // Forward to AI Gateway
        const gatewayRes = await fetch(`${AI_GATEWAY_URL}/v1/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol,
                indicators,
                prompt: prompt || null,
                userId: authResult.uid,
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!gatewayRes.ok) {
            const errText = await gatewayRes.text().catch(() => 'Unknown error');
            return NextResponse.json(
                { error: `AI Gateway error: HTTP ${gatewayRes.status}`, details: errText, analysis: null },
                { status: 502 }
            );
        }

        const result = await gatewayRes.json();

        return NextResponse.json({
            analysis: result.analysis || result,
            model: result.model,
            tokensUsed: result.tokensUsed,
        });

    } catch (error) {
        console.error('AI analyze error:', error);
        return NextResponse.json(
            { error: 'Internal error', analysis: null },
            { status: 500 }
        );
    }
}
