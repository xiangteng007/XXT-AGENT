/**
 * Discussion API Route — Dashboard Proxy
 * 
 * POST /api/agents/discuss — Start a discussion via OpenClaw Gateway
 * GET  /api/agents/discuss?taskId=xxx — Query discussion state
 */
import { NextResponse } from 'next/server';
import { gatewayFetch } from '@/app/api/market/_gateway';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const res = await gatewayFetch('/agents/discuss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (res.ok) {
            const data = await res.json();
            return NextResponse.json({ ok: true, ...data });
        }

        return NextResponse.json(
            { ok: false, error: `Gateway returned ${res.status}` },
            { status: res.status },
        );
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: 'Gateway unreachable' },
            { status: 503 },
        );
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
        return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });
    }

    try {
        const res = await gatewayFetch(`/agents/discuss/${taskId}`);
        if (res.ok) {
            const data = await res.json();
            return NextResponse.json({ ok: true, ...data });
        }
        return NextResponse.json({ ok: false, error: `Not found` }, { status: 404 });
    } catch {
        return NextResponse.json({ ok: false, error: 'Gateway unreachable' }, { status: 503 });
    }
}
