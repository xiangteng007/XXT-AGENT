'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import styles from './rules.module.css';

interface Rule {
    id: string;
    name: string;
    priority: number;
    enabled: boolean;
    match: { type: string; value: string; caseSensitive?: boolean };
    route: { databaseId: string; tags?: string[] };
    createdAt: string;
}

interface Tenant {
    id: string;
    destination: string;
}

export default function RulesPage() {
    const { getIdToken } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState('');
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [testText, setTestText] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        priority: 0,
        matchType: 'prefix',
        matchValue: '',
        databaseId: '',
        tags: '',
    });

    const loadTenants = useCallback(async () => {
        const token = await getIdToken();
        const res = await fetch('/api/admin/tenants', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            setTenants(data.tenants);
            if (data.tenants.length > 0) {
                setSelectedTenant(data.tenants[0].id);
            }
        }
        setLoading(false);
    }, [getIdToken]);

    const loadRules = useCallback(async () => {
        if (!selectedTenant) return;
        const token = await getIdToken();
        const res = await fetch(`/api/admin/rules?tenantId=${selectedTenant}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            setRules(data.rules);
        }
    }, [selectedTenant, getIdToken]);

    useEffect(() => { loadTenants(); }, [loadTenants]);
    useEffect(() => { loadRules(); }, [loadRules]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = await getIdToken();
        const res = await fetch('/api/admin/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                tenantId: selectedTenant,
                name: formData.name,
                priority: formData.priority,
                enabled: true,
                match: { type: formData.matchType, value: formData.matchValue },
                route: { databaseId: formData.databaseId, tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean) },
            }),
        });
        if (res.ok) {
            setShowForm(false);
            setFormData({ name: '', priority: 0, matchType: 'prefix', matchValue: '', databaseId: '', tags: '' });
            loadRules();
        }
    };

    const handleTest = async () => {
        if (!testText || !selectedTenant) return;
        const token = await getIdToken();
        const res = await fetch('/api/admin/rules/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tenantId: selectedTenant, text: testText }),
        });
        if (res.ok) {
            setTestResult(await res.json());
        }
    };

    const handleDelete = async (ruleId: string) => {
        if (!confirm('確定要刪除此規則？')) return;
        const token = await getIdToken();
        await fetch(`/api/admin/rules/${ruleId}?tenantId=${selectedTenant}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        loadRules();
    };

    return (
        <div>
            <div className={styles.header}>
                <h1>規則管理</h1>
                <div className={styles.headerActions}>
                    <select className="input" value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} aria-label="選擇租戶">
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? '取消' : '➕ 新增規則'}
                    </button>
                </div>
            </div>

            {showForm && (
                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div><label className="label" htmlFor="ruleName">名稱</label><input id="ruleName" className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
                        <div><label className="label" htmlFor="rulePriority">優先序</label><input id="rulePriority" className="input" type="number" value={formData.priority} onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })} /></div>
                        <div><label className="label" htmlFor="matchType">匹配類型</label>
                            <select id="matchType" className="input" value={formData.matchType} onChange={e => setFormData({ ...formData, matchType: e.target.value })} aria-label="選擇匹配類型">
                                <option value="prefix">Prefix</option><option value="keyword">Keyword</option><option value="contains">Contains</option><option value="regex">Regex</option>
                            </select>
                        </div>
                        <div><label className="label" htmlFor="matchValue">匹配值</label><input id="matchValue" className="input" value={formData.matchValue} onChange={e => setFormData({ ...formData, matchValue: e.target.value })} placeholder="#todo" required /></div>
                        <div><label className="label" htmlFor="ruleDatabaseId">Database ID</label><input id="ruleDatabaseId" className="input" value={formData.databaseId} onChange={e => setFormData({ ...formData, databaseId: e.target.value })} required /></div>
                        <div><label className="label" htmlFor="ruleTags">Tags (逗號分隔)</label><input id="ruleTags" className="input" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} placeholder="tag1, tag2" /></div>
                    </div>
                    <button type="submit" className="btn btn-primary">建立規則</button>
                </form>
            )}

            <div className={styles.testSection}>
                <h3>🧪 測試規則匹配</h3>
                <div className={styles.testRow}>
                    <input className="input flex-1" value={testText} onChange={e => setTestText(e.target.value)} placeholder="輸入測試文字..." aria-label="測試文字" />
                    <button className="btn btn-secondary" onClick={handleTest}>測試</button>
                </div>
                {testResult && (
                    <div className={styles.testResult}>
                        {testResult.matchCount > 0 ? (
                            <><span className="badge badge-success">✓ 命中 {testResult.matchCount} 條</span> 最佳: <code>{testResult.bestMatch?.name}</code> → <code>{testResult.bestMatch?.route?.databaseId?.slice(0, 8)}...</code></>
                        ) : (
                            <span className="badge badge-warning">無匹配</span>
                        )}
                    </div>
                )}
            </div>

            <table className={styles.table}>
                <thead><tr><th>優先序</th><th>名稱</th><th>匹配</th><th>目標 DB</th><th>狀態</th><th>操作</th></tr></thead>
                <tbody>
                    {rules.map(r => (
                        <tr key={r.id}>
                            <td>{r.priority}</td>
                            <td>{r.name}</td>
                            <td><code>{r.match.type}: {r.match.value}</code></td>
                            <td><code>{r.route.databaseId?.slice(0, 8)}...</code></td>
                            <td><span className={`badge ${r.enabled ? 'badge-success' : 'badge-warning'}`}>{r.enabled ? '啟用' : '停用'}</span></td>
                            <td><button className="btn btn-danger" onClick={() => handleDelete(r.id)}>刪除</button></td>
                        </tr>
                    ))}
                    {rules.length === 0 && <tr><td colSpan={6} className="text-center">尚無規則</td></tr>}
                </tbody>
            </table>
        </div>
    );
}
