'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWarRoomStore } from '@/lib/store/warRoomStore';
import { GuardianWidget } from '@/components/war-room/GuardianWidget';
import { useAuth } from '@/lib/AuthContext';

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

const GATEWAY_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? 'http://localhost:3100';

export default function GuardianPage() {
  const { getIdToken } = useAuth();
  const openCommsPanel = useWarRoomStore(s => s.openCommsPanel);
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getIdToken();
      const res = await fetch(`${GATEWAY_URL}/guardian/policies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPolicies(data.policies ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`無法載入保單資料：${msg}`);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0ea5e9] font-mono tracking-tight">
            🛡️ 保險守衛 Guardian
          </h1>
          <p className="text-[#9ca3af] text-sm mt-1">
            保單總覽、自動預約連結狀態與理賠保障分析
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPolicies}
            className="px-3 py-1.5 text-xs font-mono border border-[#0ea5e9]/30 text-[#0ea5e9] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20 rounded transition-colors"
          >
            重新整理
          </button>
          <button
            onClick={() => openCommsPanel('guardian')}
            className="px-3 py-1.5 text-xs font-mono border border-[#0ea5e9]/60 text-white bg-[#0ea5e9]/20 hover:bg-[#0ea5e9]/30 rounded transition-colors"
          >
            📡 聯繫 Guardian
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '保單總數', value: policies.length, accent: '#0ea5e9' },
          { label: '有效保單', value: policies.filter(p => p.status === 'active').length, accent: '#22c55e' },
          { label: '帳務已連結', value: policies.filter(p => p.ledger_linked).length, accent: '#22c55e' },
          { label: '待連結', value: policies.filter(p => !p.ledger_linked).length, accent: '#f59e0b' },
        ].map(stat => (
          <div
            key={stat.label}
            className="border rounded p-3 text-center"
            style={{ borderColor: `${stat.accent}30`, background: `${stat.accent}08` }}
          >
            <div className="text-2xl font-bold font-mono" style={{ color: stat.accent }}>
              {stat.value}
            </div>
            <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#9ca3af] font-mono text-sm">
          <span className="animate-pulse">LOADING POLICY DATA...</span>
        </div>
      ) : error ? (
        <div className="border border-[#ef4444]/30 bg-[#ef4444]/10 rounded p-4 text-[#ef4444] text-sm font-mono">
          ⚠ {error}
          <button onClick={fetchPolicies} className="ml-3 underline text-xs">重試</button>
        </div>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#9ca3af] font-mono text-sm gap-3">
          <span className="text-4xl">🛡️</span>
          <p>尚無保單資料</p>
          <button
            onClick={() => openCommsPanel('guardian')}
            className="mt-2 px-4 py-1.5 text-xs border border-[#0ea5e9]/30 text-[#0ea5e9] rounded hover:bg-[#0ea5e9]/10 transition-colors"
          >
            詢問 Guardian 新增保單
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map(policy => (
            <div key={policy.policy_id} className="flex flex-col gap-2">
              <GuardianWidget
                actionType="policy_summary"
                data={{
                  policy_id:      policy.policy_id,
                  policy_name:    policy.policy_name,
                  insurer:        policy.insurer,
                  status:         policy.status,
                  ledger_linked:  policy.ledger_linked,
                  annual_premium: policy.annual_premium,
                  currency:       policy.currency,
                  coverage_start: policy.coverage_start,
                  coverage_end:   policy.coverage_end,
                }}
              />
              <button
                onClick={() => openCommsPanel('guardian')}
                className="text-[10px] font-mono text-[#9ca3af] hover:text-[#0ea5e9] text-right transition-colors"
              >
                查詢此保單 →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
