/**
 * Agent State API Route
 * 
 * Proxies GET /agents/state from OpenClaw Gateway
 * Used by Matrix Center and War Room pages.
 */
import { NextResponse } from 'next/server';
import { gatewayFetch } from '@/app/api/market/_gateway';

export async function GET() {
    try {
        const res = await gatewayFetch('/agents/state');
        if (res.ok) {
            const data = await res.json();
            return NextResponse.json({
                ok: true,
                live: true,
                timestamp: new Date().toISOString(),
                ...data,
            });
        }
        return NextResponse.json({ ok: false, live: false, error: `Gateway returned ${res.status}` });
    } catch {
        return NextResponse.json({ ok: false, live: false, error: 'Gateway unreachable' });
    }
}
