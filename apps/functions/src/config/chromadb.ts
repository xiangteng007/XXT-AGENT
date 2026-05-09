/**
 * ChromaDB Configuration — Single Source of Truth
 *
 * All ChromaDB connection details are centralized here.
 * Used by: memory-store.service.ts, rag-context.service.ts, training-logger.service.ts
 */

import { logger } from 'firebase-functions/v2';

// ================================
// Connection Settings
// ================================

/** ChromaDB endpoint (NAS 192.168.31.77:8001 or env override) */
export const CHROMADB_BASE_URL = (process.env.CHROMADB_URL || 'http://192.168.31.77:8001').replace(/\/$/, '');
export const CHROMADB_AUTH_TOKEN = process.env.CHROMADB_TOKEN || '';
export const CHROMADB_TENANT = 'default_tenant';
export const CHROMADB_DATABASE = 'default_database';

/** ChromaDB v2 API base path */
export const CHROMA_API = `${CHROMADB_BASE_URL}/api/v2`;

// ================================
// Collection Names
// ================================

export const COLLECTION_MEMORIES = 'xxt_agent_memories';
export const COLLECTION_TRAINING = 'training_knowledge';

// ================================
// Shared Helpers
// ================================

export function chromaHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (CHROMADB_AUTH_TOKEN) headers['Authorization'] = `Bearer ${CHROMADB_AUTH_TOKEN}`;
    return headers;
}

export async function chromaFetch(path: string, init?: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    try {
        return await fetch(`${CHROMA_API}${path}`, {
            ...init,
            headers: { ...chromaHeaders(), ...(init?.headers as Record<string, string> || {}) },
            signal: ctrl.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

// ================================
// Health Check (shared cache)
// ================================

let chromadbAvailableCache: boolean | null = null;
let chromadbLastCheck = 0;
const CHROMADB_CACHE_TTL_MS = 30_000; // 30s cache

export async function isChromaDbAvailable(): Promise<boolean> {
    const now = Date.now();
    if (chromadbAvailableCache !== null && (now - chromadbLastCheck) < CHROMADB_CACHE_TTL_MS) {
        return chromadbAvailableCache;
    }

    try {
        const resp = await chromaFetch('/heartbeat');
        chromadbAvailableCache = resp.ok;
        chromadbLastCheck = Date.now();
        if (!resp.ok) {
            logger.warn(`[ChromaDB] Heartbeat returned ${resp.status}`);
        }
        return resp.ok;
    } catch (err) {
        chromadbAvailableCache = false;
        chromadbLastCheck = Date.now();
        logger.warn('[ChromaDB] Unreachable:', err instanceof Error ? err.message : err);
        return false;
    }
}
