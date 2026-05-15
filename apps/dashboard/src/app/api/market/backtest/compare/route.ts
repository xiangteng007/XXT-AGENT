import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../../_gateway';

/**
 * GET /api/market/backtest/compare
 *
 * Run all strategies and compare performance.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const symbol = searchParams.get('symbol') || 'NVDA';
        const start = searchParams.get('start') || '2023-01-01';
        const end = searchParams.get('end') || '2024-01-01';

        const res = await gatewayFetch(
            `/invest/backtest/compare?symbol=${encodeURIComponent(symbol)}&start=${start}&end=${end}`,
        );

        if (!res.ok) {
            return NextResponse.json(
                { error: 'Comparison failed' },
                { status: 502 },
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Backtest compare error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
