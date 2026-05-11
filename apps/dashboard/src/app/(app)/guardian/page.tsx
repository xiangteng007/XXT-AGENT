'use client';

import { useEffect, useState, useCallback } from 'react';
import { Shield, RefreshCw, FileText, DollarSign, CheckCircle, AlertCircle, Plus, Pencil, Trash2, X, Save, Clock } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface PolicySummary {
  policy_id: string;
  policy_name: string;
  insurer: string;
  status: string;
  ledger_linked: boolean;
  annual_premium: number;
  currency: string;
  coverage_start: string;
  coverage_end: string;
}

// Demo policies for when the backend is unavailable
const DEMO_POLICIES: PolicySummary[] = [
  {
    policy_id: 'POL-2026-001',
    policy_name: '工程營造綜合保險',
    insurer: '富邦產險',
    status: 'active',
    ledger_linked: true,
    annual_premium: 150000,
    currency: 'NTD',
    coverage_start: '2026-01-01',
    coverage_end: '2026-12-31',
  },
  {
    policy_id: 'POL-2026-002',
    policy_name: '第三人責任險',
    insurer: '國泰產險',
    status: 'active',
    ledger_linked: true,
    annual_premium: 85000,
    currency: 'NTD',
    coverage_start: '2026-03-01',
    coverage_end: '2027-02-28',
  },
  {
    policy_id: 'POL-2026-003',
    policy_name: '營建機具險',
    insurer: '新光產險',
    status: 'active',
    ledger_linked: false,
    annual_premium: 42000,
    currency: 'NTD',
    coverage_start: '2026-06-01',
    coverage_end: '2027-05-31',
  },
];

const STORAGE_KEY = 'xxt-guardian-policies';
const GATEWAY_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? '';

function loadLocalPolicies(): PolicySummary[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLocalPolicies(policies: PolicySummary[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(policies));
}

function getDaysUntilExpiry(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const EMPTY_FORM: PolicySummary = {
  policy_id: '', policy_name: '', insurer: '', status: 'active',
  ledger_linked: false, annual_premium: 0, currency: 'NTD',
  coverage_start: '', coverage_end: '',
};

export default function GuardianPage() {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicySummary>({ ...EMPTY_FORM });

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      // Try localStorage first
      const local = loadLocalPolicies();
      if (local && local.length > 0) {
        setPolicies(local);
        setIsDemo(false);
        setLoading(false);
        return;
      }
      // Try backend
      if (GATEWAY_URL) {
        const res = await fetch(`${GATEWAY_URL}/guardian/policies`);
        if (res.ok) {
          const data = await res.json();
          const serverPolicies = data.policies ?? [];
          if (serverPolicies.length > 0) {
            setPolicies(serverPolicies);
            saveLocalPolicies(serverPolicies);
            setIsDemo(false);
            setLoading(false);
            return;
          }
        }
      }
      // Fallback to demo
      setPolicies(DEMO_POLICIES);
      setIsDemo(true);
    } catch {
      const local = loadLocalPolicies();
      if (local && local.length > 0) {
        setPolicies(local);
        setIsDemo(false);
      } else {
        setPolicies(DEMO_POLICIES);
        setIsDemo(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const handleSave = () => {
    const id = editingId || `POL-${Date.now()}`;
    const newPolicy: PolicySummary = { ...form, policy_id: id };

    let updated: PolicySummary[];
    if (editingId) {
      updated = policies.map(p => p.policy_id === editingId ? newPolicy : p);
    } else {
      updated = [...policies, newPolicy];
    }
    setPolicies(updated);
    saveLocalPolicies(updated);
    setIsDemo(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = policies.filter(p => p.policy_id !== id);
    setPolicies(updated);
    saveLocalPolicies(updated);
  };

  const handleEdit = (policy: PolicySummary) => {
    setForm({ ...policy });
    setEditingId(policy.policy_id);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const activePolicies = policies.filter(p => p.status === 'active');
  const totalPremium = policies.reduce((sum, p) => sum + p.annual_premium, 0);
  const expiringSoon = policies.filter(p => {
    const days = getDaysUntilExpiry(p.coverage_end);
    return days >= 0 && days <= 30;
  });

  return (
    <div style={{ padding: '24px 32px 48px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: '24px', marginBottom: '32px', padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(99, 102, 241, 0.05))',
        borderRadius: '20px', border: '1px solid rgba(14, 165, 233, 0.12)', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
          }}>
            <Shield size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              保險守衛
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              保單管理、到期追蹤與理賠保障分析
              {isDemo && <span style={{ marginLeft: 8, fontSize: '11px', color: '#f59e0b' }}>● 展示模式</span>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '13px',
            fontWeight: 500, color: 'white', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            border: 'none', borderRadius: 10, cursor: 'pointer',
          }}>
            <Plus size={14} /> 新增保單
          </button>
          <button onClick={fetchPolicies} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '13px',
            fontWeight: 500, color: '#6366f1', background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, cursor: 'pointer',
          }}>
            <RefreshCw size={14} /> 重新整理
          </button>
        </div>
      </div>

      {/* Expiry Alerts */}
      {expiringSoon.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', marginBottom: 24,
          background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 14, fontSize: '13px', color: '#b45309',
        }}>
          <Clock size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>到期提醒：</strong>
            {expiringSoon.map(p => {
              const days = getDaysUntilExpiry(p.coverage_end);
              return `「${p.policy_name}」(${days <= 0 ? '已到期' : `${days} 天後到期`})`;
            }).join('、')}
          </span>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          marginBottom: 24, padding: '24px', borderRadius: 16,
          background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(99,102,241,0.15)',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {editingId ? '編輯保單' : '新增保單'}
            </h3>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>保單名稱 *</span>
              <input value={form.policy_name} onChange={e => setForm({ ...form, policy_name: e.target.value })}
                placeholder="例：工程營造綜合保險"
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13, background: 'white' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>保險公司 *</span>
              <input value={form.insurer} onChange={e => setForm({ ...form, insurer: e.target.value })}
                placeholder="例：富邦產險"
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13, background: 'white' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>年度保費</span>
              <input type="number" value={form.annual_premium || ''} onChange={e => setForm({ ...form, annual_premium: Number(e.target.value) })}
                placeholder="150000"
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13, background: 'white' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>幣別</span>
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13, background: 'white' }}>
                <option value="NTD">NTD</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>保障起始日</span>
              <input type="date" value={form.coverage_start} onChange={e => setForm({ ...form, coverage_start: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13, background: 'white' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>保障到期日</span>
              <input type="date" value={form.coverage_end} onChange={e => setForm({ ...form, coverage_end: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13, background: 'white' }} />
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ledger_linked} onChange={e => setForm({ ...form, ledger_linked: e.target.checked })} />
              <span>已連結帳務</span>
            </label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13, background: 'white' }}>
              <option value="active">有效</option>
              <option value="expired">已過期</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={handleSave} disabled={!form.policy_name || !form.insurer} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', fontSize: '13px',
              fontWeight: 500, color: 'white', background: !form.policy_name || !form.insurer ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              border: 'none', borderRadius: 10, cursor: !form.policy_name || !form.insurer ? 'not-allowed' : 'pointer',
            }}>
              <Save size={14} /> 儲存
            </button>
            <button onClick={resetForm} style={{
              padding: '8px 20px', fontSize: '13px', fontWeight: 500,
              color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, cursor: 'pointer',
            }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: '保單總數', value: policies.length, icon: FileText, color: '#6366f1' },
          { label: '有效保單', value: activePolicies.length, icon: CheckCircle, color: '#10b981' },
          { label: '年度總保費', value: `NT$ ${totalPremium.toLocaleString()}`, icon: DollarSign, color: '#f59e0b' },
          { label: '待連結帳務', value: policies.filter(p => !p.ledger_linked).length, icon: AlertCircle, color: '#ef4444' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '16px 20px', borderRadius: 16,
            background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)',
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <stat.icon size={16} color={stat.color} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</span>
            </div>
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Policy Cards */}
      {loading ? (
        <EmptyState title="載入中..." description="正在讀取保單資料" />
      ) : policies.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="尚無保單資料"
          description="新增保單以開始追蹤您的保險保障"
          actionLabel="新增保單"
          onAction={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {policies.map(policy => {
            const daysLeft = getDaysUntilExpiry(policy.coverage_end);
            const isExpiring = daysLeft >= 0 && daysLeft <= 30;
            const isExpired = daysLeft < 0;
            return (
              <div key={policy.policy_id} style={{
                padding: '24px', borderRadius: 16,
                background: 'rgba(255,255,255,0.75)',
                border: `1px solid ${isExpiring ? 'rgba(245,158,11,0.3)' : isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.06)'}`,
                backdropFilter: 'blur(12px)', transition: 'all 0.3s', position: 'relative',
              }}>
                {/* Action buttons */}
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
                  <button onClick={() => handleEdit(policy)} title="編輯"
                    style={{ background: 'rgba(99,102,241,0.08)', border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#6366f1' }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => { if (confirm(`確定要刪除「${policy.policy_name}」？`)) handleDelete(policy.policy_id); }} title="刪除"
                    style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: '11px', fontWeight: 600,
                    background: policy.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: policy.status === 'active' ? '#10b981' : '#ef4444',
                  }}>
                    {policy.status === 'active' ? '有效' : policy.status === 'expired' ? '已過期' : '已取消'}
                  </span>
                  {isExpiring && (
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: '11px', fontWeight: 600,
                      background: 'rgba(245,158,11,0.1)', color: '#b45309',
                    }}>
                      ⏰ {daysLeft} 天後到期
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{policy.policy_id}</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px', paddingRight: 60 }}>
                  {policy.policy_name}
                </h3>
                <p style={{ fontSize: '13px', color: '#6366f1', margin: '0 0 16px', fontWeight: 500 }}>
                  {policy.insurer}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>年度保費</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {policy.currency} {policy.annual_premium.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>保障期間</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {policy.coverage_start} ~ {policy.coverage_end}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>帳務連結</span>
                    <span style={{ color: policy.ledger_linked ? '#10b981' : '#f59e0b', fontWeight: 500 }}>
                      {policy.ledger_linked ? '✓ 已連結' : '⚠ 未連結'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
