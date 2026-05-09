/**
 * System Status API Route
 * 
 * Aggregates real-time status from:
 * - OpenClaw Gateway /health
 * - Ollama /api/tags + /api/ps
 * 
 * Used by /dashboard/infrastructure page.
 */
import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? 'http://localhost:3100';
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

interface OllamaModel {
    name: string;
    size: number;
    size_vram: number;
}

interface ServiceStatus {
    name: string;
    status: 'ONLINE' | 'OFFLINE' | 'WARNING';
    responseTime: number;
    metrics: Record<string, string>;
}

async function checkService(name: string, url: string): Promise<ServiceStatus> {
    const start = Date.now();
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const elapsed = Date.now() - start;
        if (res.ok) {
            return {
                name,
                status: 'ONLINE',
                responseTime: elapsed,
                metrics: { 'Response Time': `${elapsed}ms`, 'HTTP Status': `${res.status} OK` },
            };
        }
        return {
            name,
            status: 'WARNING',
            responseTime: elapsed,
            metrics: { 'HTTP Status': `${res.status}`, 'Response Time': `${elapsed}ms` },
        };
    } catch {
        return {
            name,
            status: 'OFFLINE',
            responseTime: -1,
            metrics: { 'Error': 'Connection failed' },
        };
    }
}

async function getOllamaInfo(): Promise<{
    models: OllamaModel[];
    vramUsed: number;
    vramTotal: number;
}> {
    try {
        const psRes = await fetch(`${OLLAMA_URL}/api/ps`, { signal: AbortSignal.timeout(5000) });
        if (!psRes.ok) return { models: [], vramUsed: 0, vramTotal: 0 };

        const psData = await psRes.json();
        const models: OllamaModel[] = (psData.models || []).map((m: Record<string, unknown>) => ({
            name: m.name || 'unknown',
            size: Number(m.size) || 0,
            size_vram: Number(m.size_vram) || 0,
        }));

        const vramUsed = models.reduce((sum, m) => sum + m.size_vram, 0);

        return {
            models,
            vramUsed,
            vramTotal: 16 * 1024 * 1024 * 1024, // RTX 4080 SUPER: 16GB
        };
    } catch {
        return { models: [], vramUsed: 0, vramTotal: 0 };
    }
}

export async function GET() {
    const [gateway, ollama, ollamaInfo] = await Promise.all([
        checkService('OpenClaw Gateway', `${GATEWAY_URL}/health`),
        checkService('Ollama Inference', `${OLLAMA_URL}/api/tags`),
        getOllamaInfo(),
    ]);

    // Enrich Ollama metrics
    if (ollamaInfo.models.length > 0) {
        const vramGB = (ollamaInfo.vramUsed / (1024 ** 3)).toFixed(1);
        ollama.metrics['Model'] = ollamaInfo.models.map(m => m.name).join(', ');
        ollama.metrics['VRAM Usage'] = `${vramGB} / 16 GB`;
    }

    return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        services: [gateway, ollama],
        gpu: {
            vramUsedBytes: ollamaInfo.vramUsed,
            vramTotalBytes: ollamaInfo.vramTotal,
            vramUsedPercent: ollamaInfo.vramTotal > 0
                ? Math.round((ollamaInfo.vramUsed / ollamaInfo.vramTotal) * 100)
                : 0,
            loadedModels: ollamaInfo.models.map(m => m.name),
        },
    });
}
