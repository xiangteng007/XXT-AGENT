import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../../_gateway';

/**
 * POST /api/market/portfolio/reset
 *
 * Reset virtual portfolio to initial state (NT$1,000,000).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const res = await gatewayFetch('/invest/portfolio/reset', {
            method: 'POST',
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: 'Reset failed' },
                { status: 502 },
            );
        }

        const result = await res.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Reset portfolio error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
