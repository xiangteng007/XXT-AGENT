/**
 * Bot Command Audit Log API Route
 * 
 * Proxies to OpenClaw Gateway to retrieve bot command usage analytics.
 * Used by the Bot Control Center to display command frequency and errors.
 */
import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? 'http://localhost:3100';

interface CommandLog {
    command: string;
    count: number;
    last_used: string;
    error_rate: number;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const hours = searchParams.get('hours') ?? '24';

    try {
        const res = await fetch(`${GATEWAY_URL}/audit/commands?hours=${hours}`, {
            signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
            const data = await res.json();
            return NextResponse.json({
                ok: true,
                source: 'gateway',
                timestamp: new Date().toISOString(),
                ...data,
            });
        }

        // Gateway reachable but returned error
        return NextResponse.json({
            ok: false,
            source: 'gateway',
            error: `Gateway returned ${res.status}`,
            commands: [],
        }, { status: 502 });

    } catch {
        // Gateway unreachable — return empty audit with offline indicator
        return NextResponse.json({
            ok: false,
            source: 'fallback',
            error: 'Gateway unreachable',
            commands: [] as CommandLog[],
            summary: {
                total_commands: 0,
                unique_users: 0,
                error_rate: 0,
                period_hours: parseInt(hours),
            },
        });
    }
}
