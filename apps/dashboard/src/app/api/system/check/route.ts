import { NextResponse } from 'next/server';

/**
 * Server-side health check proxy for Cloud Run services.
 * This runs on the Next.js server, avoiding browser CORS restrictions.
 */

const CR_HASH = process.env.CLOUD_RUN_PROJECT_HASH || process.env.NEXT_PUBLIC_CLOUD_RUN_PROJECT_HASH || '257379536720';
const CR_REGION = process.env.CLOUD_RUN_REGION || process.env.NEXT_PUBLIC_CLOUD_RUN_REGION || 'asia-east1';

const crUrl = (service: string, path = '/healthz') =>
  `https://${service}-${CR_HASH}.${CR_REGION}.run.app${path}`;

const SERVICES = [
  { id: 'ai-gateway',           name: 'AI Gateway',          path: '/health', emoji: '🤖' },
  { id: 'market-streamer',      name: 'Market Streamer',     path: '/healthz', emoji: '📈' },
  { id: 'quote-normalizer',     name: 'Quote Normalizer',    path: '/healthz', emoji: '📊' },
  { id: 'alert-engine',         name: 'Alert Engine',        path: '/healthz', emoji: '🔔' },
  { id: 'news-collector',       name: 'News Collector',      path: '/healthz', emoji: '📰' },
  { id: 'trade-planner-worker', name: 'Trade Planner',       path: '/healthz', emoji: '📋' },
  { id: 'event-fusion-engine',  name: 'Event Fusion',        path: '/healthz', emoji: '⚡' },
  { id: 'social-worker',        name: 'Social Worker',       path: '/healthz', emoji: '👥' },
  { id: 'social-dispatcher',    name: 'Social Dispatcher',   path: '/healthz', emoji: '📤' },
  { id: 'telegram-command-bot', name: 'Telegram Bot',        path: '/healthz', emoji: '🤖' },
];

interface CheckResult {
  name: string;
  emoji: string;
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  error?: string;
  checkedAt: string;
}

async function checkService(svc: typeof SERVICES[0]): Promise<CheckResult> {
  const url = crUrl(svc.id, svc.path);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
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
