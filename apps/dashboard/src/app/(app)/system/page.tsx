'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './system.module.css';

// ================================
// Types
// ================================

interface ServiceStatus {
    name: string;
    url: string;
    status: 'healthy' | 'unhealthy' | 'loading';
    latencyMs?: number;
    error?: string;
    checkedAt?: string;
}

// ================================
// Service Registry
// ================================

/** Cloud Run base URL pattern. Set NEXT_PUBLIC_CLOUD_RUN_PROJECT_HASH in .env to override. */
const CR_HASH = process.env.NEXT_PUBLIC_CLOUD_RUN_PROJECT_HASH || '257379536720';
const CR_REGION = process.env.NEXT_PUBLIC_CLOUD_RUN_REGION || 'asia-east1';
const crUrl = (service: string, path = '/healthz') =>
    `https://${service}-${CR_HASH}.${CR_REGION}.run.app${path}`;

const SERVICES: Array<{ name: string; url: string; emoji: string }> = [
    { name: 'AI Gateway', url: crUrl('ai-gateway', '/health'), emoji: '🤖' },
    { name: 'OpenClaw Gateway', url: crUrl('openclaw-gateway', '/health'), emoji: '🧠' },
    { name: 'Market Streamer', url: crUrl('market-streamer'), emoji: '📈' },
    { name: 'Quote Normalizer', url: crUrl('quote-normalizer'), emoji: '📊' },
    { name: 'Alert Engine', url: crUrl('alert-engine'), emoji: '🔔' },
    { name: 'News Collector', url: crUrl('news-collector'), emoji: '📰' },
    { name: 'Trade Planner', url: crUrl('trade-planner'), emoji: '📋' },
    { name: 'Event Fusion', url: crUrl('fusion-engine'), emoji: '⚡' },
    { name: 'Social Worker', url: crUrl('social-worker'), emoji: '👥' },
    { name: 'Social Collector', url: crUrl('social-collector'), emoji: '📡' },
    { name: 'Social Dispatcher', url: crUrl('social-dispatcher'), emoji: '📤' },
    { name: 'Telegram Bot', url: crUrl('telegram-bot'), emoji: '💬' },
];

// ================================
// Helper: Check service health
// ================================

async function checkServiceHealth(name: string, url: string): Promise<ServiceStatus> {
    const start = Date.now();
    try {
        const res = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        const latencyMs = Date.now() - start;

        return {
            name,
            url,
            status: res.ok ? 'healthy' : 'unhealthy',
            latencyMs,
            checkedAt: new Date().toLocaleTimeString('zh-TW'),
            error: res.ok ? undefined : `HTTP ${res.status}`,
        };
    } catch (err) {
        return {
            name,
            url,
            status: 'unhealthy',
            latencyMs: Date.now() - start,
            checkedAt: new Date().toLocaleTimeString('zh-TW'),
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}

// ================================
// Component
// ================================

export default function SystemHealthPage() {
    const [services, setServices] = useState<ServiceStatus[]>(
        SERVICES.map(s => ({ name: s.name, url: s.url, status: 'loading' as const }))
    );
    const [lastRefresh, setLastRefresh] = useState<string>('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const refreshAll = useCallback(async () => {
        setIsRefreshing(true);
        try {
            // Use server-side proxy to avoid CORS
            const res = await fetch('/api/system/check');
            if (res.ok) {
                const data = await res.json();
                const statuses: ServiceStatus[] = (data.services || []).map((s: { name: string; status: string; latencyMs: number; error?: string; checkedAt?: string }) => ({
                    name: s.name,
                    url: '',
                    status: s.status as 'healthy' | 'unhealthy',
                    latencyMs: s.latencyMs,
                    error: s.error,
                    checkedAt: s.checkedAt ? new Date(s.checkedAt).toLocaleTimeString('zh-TW') : undefined,
                }));
                setServices(statuses);
            } else {
                // Fallback: direct check (will likely CORS-fail on production)
                const results = await Promise.allSettled(
                    SERVICES.map(s => checkServiceHealth(s.name, s.url))
                );
                setServices(results.map((r, i) =>
                    r.status === 'fulfilled'
                        ? r.value
                        : { name: SERVICES[i].name, url: SERVICES[i].url, status: 'unhealthy' as const, error: 'Check failed' }
                ));
            }
        } catch {
            // Fallback to direct check
            const results = await Promise.allSettled(
                SERVICES.map(s => checkServiceHealth(s.name, s.url))
            );
            setServices(results.map((r, i) =>
                r.status === 'fulfilled'
                    ? r.value
                    : { name: SERVICES[i].name, url: SERVICES[i].url, status: 'unhealthy' as const, error: 'Check failed' }
            ));
        }
        setLastRefresh(new Date().toLocaleTimeString('zh-TW'));
        setIsRefreshing(false);
    }, []);

    // Initial load + auto-refresh every 30s
    useEffect(() => {
        refreshAll();
        if (!autoRefresh) return;
        const interval = setInterval(refreshAll, 30000);
        return () => clearInterval(interval);
    }, [refreshAll, autoRefresh]);

    // Aggregate stats
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const loadingCount = services.filter(s => s.status === 'loading').length;
    const avgLatency = Math.round(
        services.filter(s => s.latencyMs).reduce((sum, s) => sum + (s.latencyMs || 0), 0) /
        Math.max(1, services.filter(s => s.latencyMs).length)
    );

    const overallStatus = unhealthyCount > 0 ? '⚠️ 部分異常' : loadingCount > 0 ? '⏳ 檢查中...' : '✅ 全部正常';
    const overallColor = unhealthyCount > 0 ? 'danger' : 'success';

    return (
        <div>
            <h1 className={styles.title}>系統健康監控</h1>
            <p className={styles.subtitle}>
                {overallStatus} • 最後更新：{lastRefresh || '—'}
            </p>

            {/* ── Summary Cards ── */}
            <div className={styles.summaryGrid}>
                <div className={`${styles.summaryCard} ${styles[overallColor]}`}>
                    <div className={styles.summaryLabel}>整體狀態</div>
                    <div className={styles.summaryValue}>{healthyCount}/{SERVICES.length}</div>
                    <div className={styles.summaryDetail}>服務正常</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>平均延遲</div>
                    <div className={styles.summaryValue}>{avgLatency}ms</div>
                    <div className={styles.summaryDetail}>回應時間</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>異常服務</div>
                    <div className={`${styles.summaryValue} ${unhealthyCount > 0 ? styles.textDanger : ''}`}>
                        {unhealthyCount}
                    </div>
                    <div className={styles.summaryDetail}>需要關注</div>
                </div>
            </div>

            {/* ── Controls ── */}
            <div className={styles.controls}>
                <button
                    className={styles.refreshBtn}
                    onClick={refreshAll}
                    disabled={isRefreshing}
                >
                    {isRefreshing ? '🔄 檢查中...' : '🔄 立即刷新'}
                </button>
                <label className={styles.toggleLabel}>
                    <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={e => setAutoRefresh(e.target.checked)}
                    />
                    自動刷新 (30s)
                </label>
            </div>

            {/* ── Service Status Wall ── */}
            <div className={styles.serviceGrid}>
                {services.map((svc, idx) => {
                    const svcInfo = SERVICES[idx];
                    return (
                        <div
                            key={svc.name}
                            className={`${styles.serviceCard} ${styles[`status_${svc.status}`]}`}
                        >
                            <div className={styles.serviceHeader}>
                                <span className={styles.serviceEmoji}>{svcInfo.emoji}</span>
                                <span className={styles.serviceName}>{svc.name}</span>
                                <span className={styles.statusDot} data-status={svc.status} />
                            </div>
                            <div className={styles.serviceMetrics}>
                                {svc.status === 'loading' ? (
                                    <span className={styles.loadingText}>檢查中...</span>
                                ) : (
                                    <>
                                        <span className={styles.latency}>
                                            {svc.latencyMs}ms
                                        </span>
                                        {svc.error && (
                                            <span className={styles.errorText}>{svc.error}</span>
                                        )}
                                    </>
                                )}
                            </div>
                            {svc.checkedAt && (
                                <div className={styles.checkedAt}>
                                    {svc.checkedAt}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
