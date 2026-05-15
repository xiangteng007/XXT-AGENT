import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../../_gateway';

/**
 * POST /api/market/portfolio/order
 *
 * Execute a manual virtual trade order via Investment Brain simulation engine.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const body = await req.json() as {
            action: string;
            symbol: string;
            shares: number;
            price?: number;
        };

        if (!body.action || !body.symbol || !body.shares) {
            return NextResponse.json(
                { error: 'action, symbol, and shares are required' },
                { status: 400 },
            );
        }

        const params = new URLSearchParams({
            action: body.action,
            symbol: body.symbol,
            shares: String(body.shares),
        });
        if (body.price && body.price > 0) {
            params.set('price', String(body.price));
        }

        const res = await gatewayFetch(`/invest/portfolio/order?${params.toString()}`, {
            method: 'POST',
        });

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json(
                { error: `Order failed: ${errText}` },
                { status: 502 },
            );
        }

        const result = await res.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Order error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
