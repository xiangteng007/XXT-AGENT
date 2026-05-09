/**
 * Observability API Route
 * 
 * Aggregates:
 * - OpenClaw Gateway health + response time
 * - Per-agent health status (8 agents)
 * - Ollama model info + VRAM
 */
import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? 'http://localhost:3100';

interface AgentHealth {
    name: string;
    slug: string;
    status: 'ONLINE' | 'OFFLINE';
    responseTime: number;
}

const AGENT_SLUGS = [
    { name: 'Accountant', slug: 'accountant' },
    { name: 'Guardian', slug: 'guardian' },
    { name: 'Titan (BIM)', slug: 'bim' },
    { name: 'Lumi (Interior)', slug: 'interior' },
    { name: 'Rusty (Estimator)', slug: 'estimator' },
    { name: 'Lex (Legal)', slug: 'lex' },
    { name: 'Scout', slug: 'scout' },
    { name: 'Zora', slug: 'zora' },
];

async function checkAgentHealth(name: string, slug: string): Promise<AgentHealth> {
    const start = Date.now();
    try {
        const res = await fetch(`${GATEWAY_URL}/agents/${slug}/health`, {
            signal: AbortSignal.timeout(3000),
        });
        return {
            name,
            slug,
            status: res.ok ? 'ONLINE' : 'OFFLINE',
            responseTime: Date.now() - start,
        };
    } catch {
        return { name, slug, status: 'OFFLINE', responseTime: -1 };
    }
}

async function checkGateway(): Promise<{ status: string; responseTime: number; version: string }> {
    const start = Date.now();
    try {
        const res = await fetch(`${GATEWAY_URL}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        const elapsed = Date.now() - start;
        if (res.ok) {
            const data = await res.json();
            return {
                status: 'ONLINE',
                responseTime: elapsed,
                version: data.version ?? 'unknown',
            };
        }
        return { status: 'DEGRADED', responseTime: elapsed, version: 'unknown' };
    } catch {
        return { status: 'OFFLINE', responseTime: -1, version: 'unknown' };
    }
}

export async function GET() {
    const [gateway, ...agents] = await Promise.all([
        checkGateway(),
        ...AGENT_SLUGS.map(a => checkAgentHealth(a.name, a.slug)),
    ]);

    const onlineCount = agents.filter(a => a.status === 'ONLINE').length;
    const avgLatency = agents.filter(a => a.responseTime > 0).length > 0
        ? Math.round(agents.filter(a => a.responseTime > 0).reduce((s, a) => s + a.responseTime, 0) / agents.filter(a => a.responseTime > 0).length)
        : 0;

    return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        gateway,
        agents,
        summary: {
            totalAgents: agents.length,
            onlineAgents: onlineCount,
            avgLatencyMs: avgLatency,
            allOperational: gateway.status === 'ONLINE' && onlineCount === agents.length,
        },
    });
}
