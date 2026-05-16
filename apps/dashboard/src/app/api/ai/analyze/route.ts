import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '@/app/api/market/_gateway';

/**
 * POST /api/ai/analyze
 * Proxy to Investment Brain via OpenClaw Gateway for stock analysis.
 * Accepts { symbol, indicators, prompt? } and returns { analysis }.
 */

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

        // Forward to Investment Brain via OpenClaw Gateway
        const gatewayRes = await gatewayFetch('/invest/analyze', {
            method: 'POST',
            body: JSON.stringify({
                symbol,
                timeframe: '1d',
                risk_level: 'moderate',
                user_context: prompt || undefined,
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!gatewayRes.ok) {
            const errText = await gatewayRes.text().catch(() => 'Unknown error');
            return NextResponse.json(
                { error: `Analysis error: HTTP ${gatewayRes.status}`, details: errText, analysis: null },
                { status: 502 }
            );
        }

        const result = await gatewayRes.json() as Record<string, unknown>;

        // Transform investment-brain response to AI analysis format
        const marketInsight = result.market_insight as Record<string, unknown> | undefined;
        const investmentPlan = result.investment_plan as Record<string, unknown> | undefined;
        const riskAssessment = result.risk_assessment as Record<string, unknown> | undefined;
        const messages = (result.messages as string[]) || [];

        const signal = (() => {
            const action = (investmentPlan?.action as string || 'HOLD').toUpperCase();
            if (action === 'BUY' || action === 'STRONG_BUY') return 'bullish';
            if (action === 'SELL' || action === 'STRONG_SELL') return 'bearish';
            return 'neutral';
        })();

        const riskLevel = (() => {
            const level = (riskAssessment?.level as string || 'medium').toLowerCase();
            if (level === 'low' || level === 'minimal') return 'low';
            if (level === 'high' || level === 'extreme') return 'high';
            return 'medium';
        })();

        const analysis = {
            summary: (investmentPlan?.rationale as string) ||
                messages.filter(m => !m.startsWith('[Director]')).join('\n') ||
                `${symbol} 分析完成`,
            technicalSignal: signal,
            riskLevel: riskLevel,
            keyPoints: messages.map(m => m.replace(/^\[.*?\]\s*/, '')).slice(0, 5),
            recommendation: `${investmentPlan?.action || 'HOLD'} — 信心度 ${investmentPlan?.confidence || 0}/100`,
            priceTargets: {
                short: (investmentPlan?.target_price as number) || 0,
                medium: 0,
                long: 0,
            },
        };

        return NextResponse.json({
            analysis,
            sessionId: result.session_id,
            model: 'xxt/investmentbrain',
        });

    } catch (error) {
        console.error('AI analyze error:', error);
        return NextResponse.json(
            { error: 'Internal error', analysis: null },
            { status: 500 }
        );
    }
}

