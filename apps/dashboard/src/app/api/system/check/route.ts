import { NextResponse } from 'next/server';

/**
 * Server-side health check proxy for Cloud Run services.
 * Uses GCP Service Account ID Token to authenticate against IAM-protected services.
 * Falls back to unauthenticated requests for allUsers services (e.g., AI Gateway).
 */

const CR_HASH = process.env.CLOUD_RUN_PROJECT_HASH || process.env.NEXT_PUBLIC_CLOUD_RUN_PROJECT_HASH || '257379536720';
const CR_REGION = process.env.CLOUD_RUN_REGION || process.env.NEXT_PUBLIC_CLOUD_RUN_REGION || 'asia-east1';

const crUrl = (service: string, path = '/healthz') =>
  `https://${service}-${CR_HASH}.${CR_REGION}.run.app${path}`;

// Service names match actual Cloud Run deployment names
const SERVICES = [
  { id: 'ai-gateway',        name: 'AI Gateway',        path: '/health',  emoji: '🤖' },
  { id: 'openclaw-gateway',   name: 'OpenClaw Gateway',  path: '/health',  emoji: '🧠' },
  { id: 'market-streamer',    name: 'Market Streamer',   path: '/healthz', emoji: '📈' },
  { id: 'quote-normalizer',   name: 'Quote Normalizer',  path: '/healthz', emoji: '📊' },
  { id: 'alert-engine',       name: 'Alert Engine',      path: '/healthz', emoji: '🔔' },
  { id: 'news-collector',     name: 'News Collector',    path: '/healthz', emoji: '📰' },
  { id: 'trade-planner',      name: 'Trade Planner',     path: '/healthz', emoji: '📋' },
  { id: 'fusion-engine',      name: 'Event Fusion',      path: '/healthz', emoji: '⚡' },
  { id: 'social-worker',      name: 'Social Worker',     path: '/healthz', emoji: '👥' },
  { id: 'social-collector',   name: 'Social Collector',  path: '/healthz', emoji: '📡' },
  { id: 'social-dispatcher',  name: 'Social Dispatcher', path: '/healthz', emoji: '📤' },
  { id: 'telegram-bot',       name: 'Telegram Bot',      path: '/healthz', emoji: '💬' },
];

interface CheckResult {
  name: string;
  emoji: string;
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  error?: string;
  checkedAt: string;
}

// ── IAM Token Cache ──────────────────────────────────────────
let cachedIdToken: string | null = null;
let tokenExpiry = 0;

async function getGcpIdToken(targetAudience: string): Promise<string | null> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedIdToken && Date.now() < tokenExpiry - 60_000) {
    return cachedIdToken;
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
    const headers = await client.getRequestHeaders();
    const token = headers.Authorization?.replace('Bearer ', '') || null;

    if (token) {
      cachedIdToken = token;
      // JWT tokens are typically valid for 1 hour
      tokenExpiry = Date.now() + 55 * 60 * 1000;
    }

    return token ? headers.Authorization! : null;
  } catch (err) {
    console.error('Failed to get GCP ID token:', err);
    return null;
  }
}

// ── Health Check Logic ───────────────────────────────────────
async function checkService(svc: typeof SERVICES[0]): Promise<CheckResult> {
  const url = crUrl(svc.id, svc.path);
  const start = Date.now();

  try {
    // Try with IAM token first
    const authHeader = await getGcpIdToken(url.replace(svc.path, ''));
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
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

    return {
      name: svc.name,
      emoji: svc.emoji,
      status: res.ok ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - start,
      error: res.ok ? undefined : `HTTP ${res.status}`,
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
  const results = await Promise.allSettled(SERVICES.map(checkService));
  const services = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: SERVICES[i].name, emoji: SERVICES[i].emoji, status: 'unhealthy' as const, latencyMs: 0, error: 'Check failed', checkedAt: new Date().toISOString() }
  );

  const healthy = services.filter(s => s.status === 'healthy').length;

  return NextResponse.json({
    services,
    summary: { total: services.length, healthy, unhealthy: services.length - healthy },
    checkedAt: new Date().toISOString(),
  });
}
