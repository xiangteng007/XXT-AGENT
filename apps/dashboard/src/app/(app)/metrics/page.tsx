'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import styles from './metrics.module.css';

interface Metrics {
    date: string;
    ok_count: number;
    failed_count: number;
    dlq_count: number;
    notion_429: number;
    notion_5xx: number;
    avg_latency_ms: number;
}

interface MetricsData {
    tenantId: string | null;
    today: Metrics;
    yesterday: Metrics;
}

export default function MetricsPage() {
    const { getIdToken } = useAuth();
    const [data, setData] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadMetrics() {
            try {
                const token = await getIdToken();
                if (!token) { setLoading(false); return; }
                const res = await fetch('/api/admin/metrics', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    setData(await res.json());
                }
            } catch (err) {
                console.error('Failed to load metrics:', err);
            }
            setLoading(false);
        }
        loadMetrics();
    }, [getIdToken]);

    const calcRate = (ok: number, failed: number) => {
        const total = ok + failed;
        return total > 0 ? Math.round((ok / total) * 100) : 100;
    };

    const diff = (today: number, yesterday: number) => {
        const d = today - yesterday;
        if (d === 0) return null;
        return d > 0 ? `+${d}` : `${d}`;
    };

    if (loading) return <EmptyState title="載入中..." description="正在讀取統計數據" />;
    if (!data) return <ErrorState message="無法載入統計" detail="請確認已登入並有權限存取" type="auth" />;

    const todayRate = calcRate(data.today.ok_count, data.today.failed_count);
    const yesterdayRate = calcRate(data.yesterday.ok_count, data.yesterday.failed_count);

    return (
        <div>
            <h1 className={styles.title}>統計報表</h1>
            <p className={styles.subtitle}>今日 vs 昨日比較</p>

            <div className={styles.grid}>
                <div className={styles.card}>
                    <div className={styles.cardLabel}>成功率</div>
                    <div className={styles.cardValue}>{todayRate}%</div>
                    <div className={styles.cardCompare}>昨日 {yesterdayRate}%</div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardLabel}>成功次數</div>
                    <div className={styles.cardValue}>{data.today.ok_count}</div>
                    <div className={styles.cardCompare}>
                        {diff(data.today.ok_count, data.yesterday.ok_count) && (
                            <span className={data.today.ok_count >= data.yesterday.ok_count ? styles.up : styles.down}>
                                {diff(data.today.ok_count, data.yesterday.ok_count)}
                            </span>
                        )}
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardLabel}>失敗次數</div>
                    <div className={styles.cardValue}>{data.today.failed_count}</div>
                    <div className={styles.cardCompare}>
                        {diff(data.today.failed_count, data.yesterday.failed_count) && (
                            <span className={data.today.failed_count > data.yesterday.failed_count ? styles.down : styles.up}>
                                {diff(data.today.failed_count, data.yesterday.failed_count)}
                            </span>
                        )}
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardLabel}>DLQ 任務</div>
                    <div className={styles.cardValue}>{data.today.dlq_count}</div>
                    <div className={styles.cardCompare}>昨日 {data.yesterday.dlq_count}</div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardLabel}>Notion 429</div>
                    <div className={styles.cardValue}>{data.today.notion_429}</div>
                    <div className={styles.cardCompare}>昨日 {data.yesterday.notion_429}</div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardLabel}>Notion 5xx</div>
                    <div className={styles.cardValue}>{data.today.notion_5xx}</div>
                    <div className={styles.cardCompare}>昨日 {data.yesterday.notion_5xx}</div>
                </div>
            </div>
        </div>
    );
}
