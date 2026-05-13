import { NextResponse } from 'next/server';

/**
 * Server-side health check proxy for Cloud Run services.
 * Uses GCP Service Account ID Token to authenticate against IAM-protected services.
 * Falls back to unauthenticated requests for allUsers services (e.g., AI Gateway).
 */

// Force dynamic rendering — no edge caching for health checks
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cloud Run URL format: SERVICE-HASH.a.run.app (classic format)
const CR_HASH = process.env.CLOUD_RUN_SERVICE_HASH || 'hwx3zjt7lq-de';

const crUrl = (service: string, path = '/healthz') =>
  `https://${service}-${CR_HASH}.a.run.app${path}`;

// Service names match actual Cloud Run deployment names
// Path per service verified from source: FastAPI → /health, aiohttp → /healthz
const SERVICES = [
  { id: 'ai-gateway',        name: 'AI Gateway',        path: '/health',  emoji: '🤖' },  // Express
  { id: 'openclaw-gateway',   name: 'OpenClaw Gateway',  path: '/health',  emoji: '🧠' },  // NestJS
  { id: 'regulation-rag',     name: 'Regulation RAG',    path: '/health',  emoji: '⚖️' },  // FastAPI
  { id: 'market-streamer',    name: 'Market Streamer',   path: '/health',  emoji: '📈' },  // aiohttp
  { id: 'quote-normalizer',   name: 'Quote Normalizer',  path: '/health',  emoji: '📊' },  // aiohttp
  { id: 'alert-engine',       name: 'Alert Engine',      path: '/health',  emoji: '🔔' },  // aiohttp
  { id: 'news-collector',     name: 'News Collector',    path: '/health',  emoji: '📰' },  // aiohttp
  { id: 'trade-planner',      name: 'Trade Planner',     path: '/health',  emoji: '📋' },  // aiohttp
  { id: 'fusion-engine',      name: 'Event Fusion',      path: '/health',  emoji: '⚡' },  // aiohttp
  { id: 'social-worker',      name: 'Social Worker',     path: '/health',  emoji: '👥' },  // FastAPI
  { id: 'social-collector',   name: 'Social Collector',  path: '/health',  emoji: '📡' },  // FastAPI (social-dispatcher)
  { id: 'telegram-bot',       name: 'Telegram Bot',      path: '/health',  emoji: '💬' },  // aiohttp
];

interface CheckResult {
  name: string;
  emoji: string;
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  error?: string;
  checkedAt: string;
}

// ── IAM Token Cache (per-audience) ───────────────────────────
const tokenCache = new Map<string, { header: string; expiry: number }>();

async function getGcpIdToken(targetAudience: string): Promise<string | null> {
  // Return cached token if still valid (with 60s buffer)
  const cached = tokenCache.get(targetAudience);
  if (cached && Date.now() < cached.expiry - 60_000) {
    return cached.header;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    return null; // No credentials → will try unauthenticated
  }

  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });

    const client = await auth.getIdTokenClient(targetAudience);
    const reqHeaders = await client.getRequestHeaders();
    // getRequestHeaders() may return Headers or plain object depending on version
    let authValue = '';
    if (typeof (reqHeaders as unknown as { get?: unknown }).get === 'function') {
      authValue = (reqHeaders as unknown as { get(k: string): string }).get('Authorization') || '';
    } else {
      authValue = String((reqHeaders as unknown as Record<string, unknown>)['Authorization'] || '')
    }

    if (authValue) {
      tokenCache.set(targetAudience, {
        header: authValue,
        expiry: Date.now() + 55 * 60 * 1000,
      });
    }

    return authValue || null;
  } catch (err) {
    console.error('Failed to get GCP ID token:', err);
    return null;
  }
}

// ── Health Check Logic ───────────────────────────────────────
async function checkServiceWithToken(
  svc: typeof SERVICES[0],
  url: string,
  authHeader: string | null,
): Promise<CheckResult> {
  const start = Date.now();
  const hadToken = Boolean(authHeader);

  try {
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    // If 403 with token, report as IAM issue; if 403 without token, expected
    if (res.status === 403) {
      return {
        name: svc.name,
        emoji: svc.emoji,
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: authHeader ? 'IAM denied' : 'IAM required (no credentials)',
        checkedAt: new Date().toISOString(),
      };
    }

    let errorInfo: string | undefined;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      errorInfo = `HTTP ${res.status} (token:${hadToken}) body:${body.slice(0, 80)}`;
    }
    return {
      name: svc.name,
      emoji: svc.emoji,
      status: res.ok ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - start,
      error: errorInfo,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: svc.name,
      emoji: svc.emoji,
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function GET() {
  // Pre-generate tokens for all unique audiences SEQUENTIALLY
  // This avoids concurrent token generation race conditions
  const tokenMap = new Map<string, string | null>();
  for (const svc of SERVICES) {
    const audience = crUrl(svc.id, '').replace(/\/$/, '');
    if (!tokenMap.has(audience)) {
      tokenMap.set(audience, await getGcpIdToken(audience));
    }
  }

  // Diagnostic info
  const tokenDiag = {
    totalAudiences: tokenMap.size,
    withToken: Array.from(tokenMap.values()).filter(Boolean).length,
    audiences: Object.fromEntries(
      Array.from(tokenMap.entries()).map(([k, v]) => [k.split('-hwx')[0].split('//')[1], Boolean(v)])
    ),
  };

  // Now run health checks concurrently with pre-resolved tokens
  const checkWithToken = (svc: typeof SERVICES[0]) => {
    const url = crUrl(svc.id, svc.path);
    const audience = crUrl(svc.id, '').replace(/\/$/, '');
    const token = tokenMap.get(audience) ?? null;
    return checkServiceWithToken(svc, url, token);
  };

  const results = await Promise.allSettled(SERVICES.map(checkWithToken));
  const services = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: SERVICES[i].name, emoji: SERVICES[i].emoji, status: 'unhealthy' as const, latencyMs: 0, error: 'Check failed', checkedAt: new Date().toISOString() }
  );

  const healthy = services.filter(s => s.status === 'healthy').length;

  return NextResponse.json({
    services,
    summary: { total: services.length, healthy, unhealthy: services.length - healthy },
    _diag: tokenDiag,
    checkedAt: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
