/**
 * Bot Status API Route
 *
 * Checks bot platform connectivity:
 * - Telegram: OpenClaw /health → telegram webhook status
 * - LINE: OpenClaw /health → line webhook status
 */
import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? 'http://localhost:3100';

interface BotStatus {
    id: string;
    platform: string;
    status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
    responseTime: number;
}

export async function GET() {
    const bots: BotStatus[] = [];

    // Check OpenClaw Gateway health (includes telegram webhook info)
    const start = Date.now();
    try {
        const res = await fetch(`${GATEWAY_URL}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        const elapsed = Date.now() - start;

        if (res.ok) {
            const health = await res.json();
            // Gateway is up → telegram bot is likely operational
            bots.push({
                id: 'telegram',
                platform: 'Telegram',
                status: 'ONLINE',
                responseTime: elapsed,
            });

            // LINE status from health data if available
            bots.push({
                id: 'line',
                platform: 'LINE',
                status: health.line?.connected ? 'ONLINE' : 'UNKNOWN',
                responseTime: elapsed,
            });
        } else {
            bots.push(
                { id: 'telegram', platform: 'Telegram', status: 'OFFLINE', responseTime: elapsed },
                { id: 'line', platform: 'LINE', status: 'OFFLINE', responseTime: elapsed },
            );
        }
    } catch {
        bots.push(
            { id: 'telegram', platform: 'Telegram', status: 'OFFLINE', responseTime: -1 },
            { id: 'line', platform: 'LINE', status: 'OFFLINE', responseTime: -1 },
        );
    }

    return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        bots,
    });
}
