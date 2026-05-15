import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../../_gateway';

/**
 * GET /api/market/portfolio/trades
 *
 * Get virtual trade history from Investment Brain simulation engine.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limit = searchParams.get('limit') || '50';

        const res = await gatewayFetch(`/invest/trades?limit=${limit}`);

        if (!res.ok) {
            return NextResponse.json({ trades: [], total: 0 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Get trades error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
