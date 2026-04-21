'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import styles from './jobs.module.css';

interface Job {
    id: string;
    tenantId: string;
    status: string;
    attempts: number;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
}

export default function JobsPage() {
    const { getIdToken } = useAuth();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    const loadJobs = useCallback(async () => {
        setLoading(true);
        const token = await getIdToken();
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        params.set('limit', '100');

        const res = await fetch(`/api/admin/jobs?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            setJobs(data.jobs);
        }
        setLoading(false);
    }, [getIdToken, statusFilter]);

    useEffect(() => { loadJobs(); }, [loadJobs]);

    const handleRequeue = async (jobId: string) => {
        const token = await getIdToken();
        const res = await fetch(`/api/admin/jobs/${jobId}/requeue`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) loadJobs();
        else alert('Requeue failed');
    };

    const handleIgnore = async (jobId: string) => {
        if (!confirm('確定要忽略此任務？')) return;
        const token = await getIdToken();
        const res = await fetch(`/api/admin/jobs/${jobId}/ignore`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) loadJobs();
    };

    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            queued: 'badge-info', processing: 'badge-warning', done: 'badge-success',
            failed: 'badge-error', dead: 'badge-error', ignored: 'badge-warning',
        };
        return <span className={`badge ${map[status] || ''}`}>{status}</span>;
    };

    return (
        <div>
            <div className={styles.header}>
                <h1>任務佇列</h1>
                <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="篩選任務狀態">
                    <option value="">全部狀態</option>
                    <option value="queued">Queued</option>
                    <option value="processing">Processing</option>
                    <option value="done">Done</option>
                    <option value="failed">Failed</option>
                    <option value="dead">Dead</option>
                    <option value="ignored">Ignored</option>
                </select>
            </div>

            {loading ? <p>載入中...</p> : (
                <table className={styles.table}>
                    <thead><tr><th>Job ID</th><th>Tenant</th><th>狀態</th><th>Attempts</th><th>建立時間</th><th>操作</th></tr></thead>
                    <tbody>
                        {jobs.map(j => (
                            <tr key={j.id}>
                                <td><code>{j.id.slice(0, 8)}...</code></td>
                                <td>{j.tenantId}</td>
                                <td>{statusBadge(j.status)}</td>
                                <td>{j.attempts}</td>
                                <td>{j.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                                <td>
                                    {['failed', 'dead'].includes(j.status) && (
                                        <button className="btn btn-primary" onClick={() => handleRequeue(j.id)}>🔄 重送</button>
                                    )}
                                    {['queued', 'processing', 'failed'].includes(j.status) && (
                                        <button className="btn btn-secondary" onClick={() => handleIgnore(j.id)}>忽略</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {jobs.length === 0 && <tr><td colSpan={6} className="text-center">無任務</td></tr>}
                    </tbody>
                </table>
            )}
        </div>
    );
}
