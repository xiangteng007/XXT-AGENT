'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Activity, AlertTriangle, CheckCircle, DollarSign, BarChart3, FileText, RefreshCw } from 'lucide-react';
import { TaxPlanner } from '@/components/financial/TaxPlanner';

interface LedgerEntry {
  entry_id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  payment_method?: string;
  created_at?: string;
}

interface FinancialData {
  ok: boolean;
  timestamp: string;
  summary: {
    period: string;
    total_income_taxed: number;
    total_expense_taxed: number;
  } | null;
  ledger: LedgerEntry[];
}

// Fallback sample entries shown when API is unavailable (with ⚠️ banner)
const SAMPLE_LEDGER: LedgerEntry[] = [
  { entry_id: 'DEMO-001', type: 'expense', category: 'material', description: '尚無資料 — 連線 OpenClaw 後顯示即時帳本', amount: 0 },
];

export default function FinancialConstructionPage() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/system/financial');
      if (res.ok) {
        const json: FinancialData = await res.json();
        setData(json);
        setIsLive(json.summary !== null);
      }
    } catch {
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // 60s refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const entries = (data?.ledger && data.ledger.length > 0) ? data.ledger : SAMPLE_LEDGER;
  const totalIncome = data?.summary?.total_income_taxed ?? 0;
  const totalExpense = data?.summary?.total_expense_taxed ?? 0;
  const netAmount = totalIncome - totalExpense;

  const metrics = [
    {
      title: 'Total Income',
      value: `NT$ ${totalIncome.toLocaleString()}`,
      sub: isLive ? '即時數據' : '展示用數據',
      subColor: isLive ? 'var(--success)' : 'var(--warning)',
      borderColor: 'var(--accent-primary)',
      icon: DollarSign,
    },
    {
      title: 'Total Expense',
      value: `NT$ ${totalExpense.toLocaleString()}`,
      sub: isLive ? `期間: ${data?.summary?.period}` : '展示用數據',
      subColor: isLive ? 'var(--info)' : 'var(--warning)',
      borderColor: 'var(--danger)',
      icon: BarChart3,
    },
    {
      title: 'Net Amount',
      value: `NT$ ${netAmount.toLocaleString()}`,
      sub: netAmount >= 0 ? '正向現金流' : '需注意支出',
      subColor: netAmount >= 0 ? 'var(--success)' : 'var(--danger)',
      borderColor: netAmount >= 0 ? 'var(--success)' : 'var(--danger)',
      icon: netAmount >= 0 ? CheckCircle : AlertTriangle,
    },
    {
      title: 'Ledger Entries',
      value: `${entries.length}`,
      sub: '本期記錄數',
      subColor: 'var(--text-muted)',
      borderColor: 'var(--glass-border)',
      icon: Activity,
    },
  ];

  return (
    <div className="dashboard-dark min-h-screen w-full bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] p-4 md:p-8 overflow-y-auto">

      {/* Live/Mock Banner */}
      {!isLive && !loading && (
        <div className="mb-4 px-4 py-2.5 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/5 flex items-center gap-2 text-xs text-[var(--warning)]">
          <span className="font-bold uppercase tracking-widest">⚠️ FALLBACK</span>
          <span className="text-[var(--text-muted)]">OpenClaw Gateway 無回應，顯示備用資料。連線後自動切換即時數據。</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-[var(--glass-bg)] rounded-xl border border-[var(--accent-primary)]/40 shadow-[0_0_15px_rgba(217,119,6,0.15)]">
              <DollarSign className="text-[var(--accent-primary)]" size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-outfit, Outfit)' }}>
              Financial &amp; Engineering Ledger
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm md:text-base md:ml-16">
            {isLive ? (
              <>即時數據 — <span className="text-[var(--success)] font-bold">LIVE</span></>
            ) : '連線至 OpenClaw 後顯示即時數據'}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] text-sm font-medium hover:border-[var(--accent-primary)]/40 transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] text-sm font-medium hover:border-[var(--accent-primary)]/40 transition-all">
            <FileText size={13} />Export CSV
          </button>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="flex overflow-x-auto gap-4 mb-8 snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none' }}>
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.title} className="snap-start min-w-[260px] md:min-w-0 md:flex-1 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] rounded-2xl p-5 border hover:shadow-lg transition-all duration-300" style={{ borderColor: `${m.borderColor}40` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">{m.title}</span>
                <Icon size={16} style={{ color: m.borderColor }} />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mb-1">{m.value}</div>
              <div className="text-xs" style={{ color: m.subColor }}>{m.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Ledger Table */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center gap-2">
          <AlertTriangle size={16} className="text-[var(--accent-primary)]" />
          <h2 className="text-sm font-bold uppercase tracking-widest">
            {isLive ? 'Live Ledger' : 'Recent Audit Ledger'}
          </h2>
          {isLive && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30">
              LIVE
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                {['ID', 'Type', 'Category', 'Description', 'Amount'].map((col) => (
                  <th key={col} className="px-5 py-3 text-left text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((row, i) => (
                <tr key={row.entry_id} className={`border-b border-[var(--glass-border)]/50 hover:bg-[var(--bg-elevated)] transition-colors ${i % 2 !== 0 ? 'bg-white/[0.01]' : ''}`}>
                  <td className="px-5 py-3 font-mono text-[var(--text-primary)] font-bold text-xs whitespace-nowrap">{row.entry_id}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                      row.type === 'income'
                        ? 'text-[var(--success)] border-[var(--success)]/40 bg-[var(--success)]/10'
                        : 'text-[var(--danger)] border-[var(--danger)]/40 bg-[var(--danger)]/10'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--text-muted)] text-xs whitespace-nowrap">{row.category}</td>
                  <td className="px-5 py-3 text-[var(--text-secondary)] text-xs">{row.description}</td>
                  <td className="px-5 py-3 font-mono font-bold text-xs whitespace-nowrap" style={{ color: row.amount >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                    NT$ {row.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Planner Component */}
      <TaxPlanner />
    </div>
  );
}
