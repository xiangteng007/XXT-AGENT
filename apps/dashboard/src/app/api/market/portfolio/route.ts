import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../_gateway';

/**
 * GET /api/market/portfolio
 *
 * Proxies the Investment Brain portfolio endpoint.
 * Returns positions, cash, total value, and P&L.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const res = await gatewayFetch('/invest/portfolio');

        if (!res.ok) {
            // Return empty portfolio on failure
            return NextResponse.json({
                portfolio: {
                    total_value: 100_000,
                    cash: 100_000,
                    positions: [],
                    daily_pnl: 0,
                    total_pnl: 0,
                    total_pnl_pct: 0,
                },
            });
        }

        const data = await res.json() as Record<string, unknown>;
        return NextResponse.json(data);
    } catch (error) {
        console.error('Portfolio error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/market/portfolio/analyze
 *
 * Triggers a full portfolio analysis via Investment Brain.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const body = await req.json() as { symbol?: string; action?: string };

        const res = await gatewayFetch('/invest/analyze', {
            method: 'POST',
            body: JSON.stringify({
                symbol: body.symbol ?? 'portfolio',
                action: body.action ?? 'full_analysis',
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json(
                { error: `Analysis failed: ${errText}` },
                { status: 502 },
            );
        }

        const result = await res.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Portfolio analysis error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
