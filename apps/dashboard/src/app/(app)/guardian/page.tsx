'use client';

import { useEffect, useState, useCallback } from 'react';
import { Shield, RefreshCw, FileText, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
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

const GATEWAY_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? '';

export default function GuardianPage() {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      if (!GATEWAY_URL) {
        setPolicies(DEMO_POLICIES);
        setIsDemo(true);
        setLoading(false);
        return;
      }
      const res = await fetch(`${GATEWAY_URL}/guardian/policies`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPolicies(data.policies ?? []);
      setIsDemo(false);
    } catch {
      setPolicies(DEMO_POLICIES);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const activePolicies = policies.filter(p => p.status === 'active');
  const totalPremium = policies.reduce((sum, p) => sum + p.annual_premium, 0);

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
        <button onClick={fetchPolicies} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '13px',
          fontWeight: 500, color: '#6366f1', background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, cursor: 'pointer',
        }}>
          <RefreshCw size={14} /> 重新整理
        </button>
      </div>

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
          onAction={() => alert('保單新增功能開發中')}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {policies.map(policy => (
            <div key={policy.policy_id} style={{
              padding: '24px', borderRadius: 16,
              background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.06)',
              backdropFilter: 'blur(12px)', transition: 'all 0.3s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: '11px', fontWeight: 600,
                  background: policy.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: policy.status === 'active' ? '#10b981' : '#ef4444',
                }}>
                  {policy.status === 'active' ? '有效' : '已過期'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{policy.policy_id}</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
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
          ))}
        </div>
      )}
    </div>
  );
}
