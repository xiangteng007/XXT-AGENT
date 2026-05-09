/**
 * NAS ChromaDB Health API Route
 * 
 * Checks ChromaDB heartbeat via CHROMADB_URL env var.
 * Returns connection status + collection list.
 */
import { NextResponse } from 'next/server';

const CHROMADB_URL = process.env.CHROMADB_URL ?? 'http://localhost:8000';
const CHROMADB_TOKEN = process.env.CHROMADB_TOKEN ?? '';

async function fetchChromaDB(path: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (CHROMADB_TOKEN) headers['Authorization'] = `Bearer ${CHROMADB_TOKEN}`;

    return fetch(`${CHROMADB_URL}${path}`, {
        headers,
        signal: AbortSignal.timeout(5000),
    });
}

export async function GET() {
    const start = Date.now();

    // 1. Heartbeat
    let heartbeat = false;
    let heartbeatMs = -1;
    try {
        const res = await fetchChromaDB('/api/v2/heartbeat');
        heartbeatMs = Date.now() - start;
        heartbeat = res.ok;
    } catch { /* offline */ }

    // 2. Collections list
    let collections: string[] = [];
    if (heartbeat) {
        try {
            const tenant = process.env.CHROMADB_TENANT ?? 'default_tenant';
            const database = process.env.CHROMADB_DATABASE ?? 'default_database';
            const res = await fetchChromaDB(`/api/v2/tenants/${tenant}/databases/${database}/collections`);
            if (res.ok) {
                const data = await res.json();
                collections = Array.isArray(data) ? data.map((c: { name?: string }) => c.name ?? 'unknown') : [];
            }
        } catch { /* skip */ }
    }

    return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        chromadb: {
            url: CHROMADB_URL.replace(/\/\/(.+?)@/, '//***@'), // mask credentials
            heartbeat,
            responseTime: heartbeatMs,
            authenticated: Boolean(CHROMADB_TOKEN),
            collections,
            collectionCount: collections.length,
        },
    });
}
