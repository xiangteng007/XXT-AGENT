/**
 * GPU VRAM Monitoring API Route
 * 
 * Proxies to Ollama API to retrieve currently loaded models and VRAM usage.
 * Used by the System Health and GPU monitoring dashboard panels.
 * 
 * @endpoint GET /api/system/gpu
 */
import { NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

interface OllamaModel {
    name: string;
    model: string;
    size: number;
    digest: string;
    expires_at: string;
    size_vram: number;
}

interface GPUStatus {
    ollama_reachable: boolean;
    response_time_ms: number;
    loaded_models: Array<{
        name: string;
        vram_mb: number;
        total_size_mb: number;
        expires_at: string;
    }>;
    total_vram_used_mb: number;
    available_models: string[];
}

export async function GET() {
    const status: GPUStatus = {
        ollama_reachable: false,
        response_time_ms: -1,
        loaded_models: [],
        total_vram_used_mb: 0,
        available_models: [],
    };

    const start = Date.now();

    // 1. Check loaded models (VRAM usage)
    try {
        const res = await fetch(`${OLLAMA_URL}/api/ps`, {
            signal: AbortSignal.timeout(5000),
        });
        status.response_time_ms = Date.now() - start;

        if (res.ok) {
            status.ollama_reachable = true;
            const data = await res.json();
            const models = (data.models ?? []) as OllamaModel[];
            
            status.loaded_models = models.map(m => ({
                name: m.name,
                vram_mb: Math.round((m.size_vram ?? m.size) / 1024 / 1024),
                total_size_mb: Math.round(m.size / 1024 / 1024),
                expires_at: m.expires_at,
            }));

            status.total_vram_used_mb = status.loaded_models.reduce(
                (sum, m) => sum + m.vram_mb, 0
            );
        }
    } catch {
        status.response_time_ms = Date.now() - start;
    }

    // 2. List installed models
    if (status.ollama_reachable) {
        try {
            const res = await fetch(`${OLLAMA_URL}/api/tags`, {
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
                const data = await res.json();
                status.available_models = (data.models ?? []).map(
                    (m: { name: string }) => m.name
                );
            }
        } catch { /* skip */ }
    }

    return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        gpu: status,
        config: {
            ollama_url: OLLAMA_URL.replace(/:\/\/[^@]+@/, '://***@'),
            gpu_model: 'RTX 4080 SUPER',
            vram_total_mb: 16384,
        },
    });
}
