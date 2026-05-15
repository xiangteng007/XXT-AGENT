import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../../market/_gateway';

/**
 * POST /api/ai/preference
 *
 * Record user preference (accept/reject) for DPO training.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const body = await req.json();
        const { session_id, action, reason } = body;

        if (!session_id || !action) {
            return NextResponse.json(
                { error: 'session_id and action are required' },
                { status: 400 },
            );
        }

        if (!['accept', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: 'action must be accept or reject' },
                { status: 400 },
            );
        }

        const res = await gatewayFetch('/invest/training/preference', {
            method: 'POST',
            body: JSON.stringify({ session_id, action, reason }),
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: 'Preference recording failed' },
                { status: 502 },
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Preference API error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
