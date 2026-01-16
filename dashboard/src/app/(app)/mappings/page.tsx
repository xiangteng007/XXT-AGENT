'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import styles from './mappings.module.css';

interface Mapping {
    id: string;
    databaseId: string;
    fields: Record<string, string>;
    defaults: Record<string, unknown>;
    createdAt: string;
}

interface Tenant { id: string; destination: string; }

export default function MappingsPage() {
    const { getIdToken } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState('');
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ databaseId: '', titleField: 'Name', contentField: '', tagsField: 'Tags', dateField: 'Date' });

    const loadTenants = async () => {
        const token = await getIdToken();
        const res = await fetch('/api/admin/tenants', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            setTenants(data.tenants);
            if (data.tenants.length > 0) setSelectedTenant(data.tenants[0].id);
        }
        setLoading(false);
    };

    const loadMappings = async () => {
        if (!selectedTenant) return;
        const token = await getIdToken();
        const res = await fetch(`/api/admin/mappings?tenantId=${selectedTenant}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            setMappings(data.mappings);
        }
    };

    useEffect(() => { loadTenants(); }, [getIdToken]);
    useEffect(() => { loadMappings(); }, [selectedTenant, getIdToken]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = await getIdToken();
        const res = await fetch('/api/admin/mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                tenantId: selectedTenant,
                databaseId: formData.databaseId,
                fields: { title: formData.titleField, content: formData.contentField, tags: formData.tagsField, date: formData.dateField },
            }),
        });
        if (res.ok) {
            setShowForm(false);
            loadMappings();
        }
    };

    const handleDelete = async (mappingId: string) => {
        if (!confirm('確定刪除？')) return;
        const token = await getIdToken();
        await fetch(`/api/admin/mappings/${mappingId}?tenantId=${selectedTenant}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        loadMappings();
    };

    return (
        <div>
            <div className={styles.header}>
                <h1>欄位映射</h1>
                <div className={styles.headerActions}>
                    <select className="input" value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)} style={{ width: 200 }}>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? '取消' : '➕ 新增'}</button>
                </div>
            </div>

            {showForm && (
                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div><label className="label">Database ID</label><input className="input" value={formData.databaseId} onChange={e => setFormData({ ...formData, databaseId: e.target.value })} required /></div>
                        <div><label className="label">Title 欄位</label><input className="input" value={formData.titleField} onChange={e => setFormData({ ...formData, titleField: e.target.value })} /></div>
                        <div><label className="label">Content 欄位</label><input className="input" value={formData.contentField} onChange={e => setFormData({ ...formData, contentField: e.target.value })} /></div>
                        <div><label className="label">Tags 欄位</label><input className="input" value={formData.tagsField} onChange={e => setFormData({ ...formData, tagsField: e.target.value })} /></div>
                        <div><label className="label">Date 欄位</label><input className="input" value={formData.dateField} onChange={e => setFormData({ ...formData, dateField: e.target.value })} /></div>
                    </div>
                    <button type="submit" className="btn btn-primary">建立映射</button>
                </form>
            )}

            <table className={styles.table}>
                <thead><tr><th>Database ID</th><th>Title</th><th>Tags</th><th>Date</th><th>操作</th></tr></thead>
                <tbody>
                    {mappings.map(m => (
                        <tr key={m.id}>
                            <td><code>{m.databaseId?.slice(0, 12)}...</code></td>
                            <td>{m.fields?.title}</td>
                            <td>{m.fields?.tags}</td>
                            <td>{m.fields?.date}</td>
                            <td><button className="btn btn-danger" onClick={() => handleDelete(m.id)}>刪除</button></td>
                        </tr>
                    ))}
                    {mappings.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>尚無映射</td></tr>}
                </tbody>
            </table>
        </div>
    );
}
