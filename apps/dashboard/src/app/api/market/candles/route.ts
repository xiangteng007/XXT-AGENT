import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../_gateway';

/**
 * GET /api/market/candles?symbol=0050&start=2023-01-01&end=2024-01-01
 *
 * Proxies symbol candles through the Investment Brain.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const symbol = req.nextUrl.searchParams.get('symbol');
        const start = req.nextUrl.searchParams.get('start');
        const end = req.nextUrl.searchParams.get('end');

        if (!symbol || !start || !end) {
            return NextResponse.json({ error: 'symbol, start, end are required' }, { status: 400 });
        }

        const res = await gatewayFetch(
            `/invest/candles?symbol=${encodeURIComponent(symbol)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        );

        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json({ error: text || 'Failed to fetch candles' }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Market candles error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
