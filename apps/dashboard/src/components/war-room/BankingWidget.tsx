'use client';

import React from 'react';

export interface BankingWidgetProps {
  actionType: 'tax_plan' | 'bank_summary' | 'bank_transaction';
  data: {
    // tax_plan
    year?: number;
    total_deductible?: number;
    deductions?: Array<{ category: string; claimable: number; limit: number }>;
    note?: string;
    // bank_summary
    grand_total_twd?: number;
    by_entity?: Array<{ entity_label: string; total_balance: number }>;
    // bank_transaction
    entry_id?: string;
    type?: 'income' | 'expense';
    amount?: number;
    currency?: string;
    date?: string;
    category?: string;
    description?: string;
    entity?: string;
  };
}

export function BankingWidget({ actionType, data }: BankingWidgetProps) {
  return (
    <div className="flex flex-col w-full mt-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] rounded-xl shadow-md overflow-hidden font-mono text-[var(--text-primary)] transition-all">
      <div className="bg-[var(--glass-bg)] px-3 py-1.5 border-b border-[var(--glass-border)] flex justify-between items-center">
        <span className="text-[var(--accent-primary)] text-xs font-bold tracking-widest uppercase">
          [ {actionType.replace(/_/g, ' ').toUpperCase()} ]
        </span>
        <span className="text-[var(--text-muted)] text-[10px] tracking-wider">KAY_ACCOUNTING</span>
      </div>
      <div className="p-4 space-y-3">
        {actionType === 'tax_plan' && data && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center text-[var(--accent-primary)] font-bold border-b border-[var(--glass-border)] pb-1">
              <span>報稅年度</span>
              <span>{data.year}</span>
            </div>
            
            <div className="flex justify-between items-center mt-2">
              <span className="text-[var(--text-muted)] text-xs">總扣除額</span>
              <span className="text-[var(--success)]">{data.total_deductible?.toLocaleString()} NTD</span>
            </div>

            {data.deductions && data.deductions.map((d, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-[var(--text-muted)] text-[10px] uppercase">{d.category}</span>
                <span className="text-[var(--text-primary)] text-xs">{d.claimable?.toLocaleString()} / {d.limit?.toLocaleString()}</span>
              </div>
            ))}
            
            <div className="text-[10px] text-[var(--danger)] mt-2 italic">
              * {data.note || '僅供估算'}
            </div>
          </div>
        )}

        {actionType === 'bank_summary' && data && (
          <div className="flex flex-col gap-2 text-sm">
             <div className="flex justify-between items-center text-[var(--accent-primary)] font-bold border-b border-[var(--glass-border)] pb-1">
              <span>總資產餘額</span>
              <span>{data.grand_total_twd?.toLocaleString()} NTD</span>
            </div>
            {data.by_entity?.map((ent, i) => (
              <div key={i} className="flex justify-between items-center mt-1">
                <span className="text-[var(--text-muted)] text-xs">{ent.entity_label}</span>
                <span className="text-[var(--text-primary)]">{ent.total_balance?.toLocaleString()} NTD</span>
              </div>
            ))}
          </div>
        )}

        {actionType === 'bank_transaction' && data && (
          <div className="flex flex-col gap-2 text-sm">
            {/* Amount — color-coded by transaction type */}
            <div className="flex justify-between items-center border-b border-[var(--glass-border)] pb-2">
              <span className="text-[var(--text-muted)] text-xs uppercase tracking-wider">
                {data.type === 'income' ? '▲ 收入' : '▼ 支出'}
              </span>
              <span className={`text-lg font-bold ${data.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {data.type === 'expense' ? '-' : '+'}{data.amount?.toLocaleString()} {data.currency ?? 'NTD'}
              </span>
            </div>

            {/* Date */}
            {data.date && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)] text-[10px] uppercase">日期</span>
                <span className="text-[var(--text-primary)] text-xs">{data.date}</span>
              </div>
            )}

            {/* Category */}
            {data.category && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)] text-[10px] uppercase">類別</span>
                <span className="text-[var(--accent-primary)] text-xs">{data.category}</span>
              </div>
            )}

            {/* Entity */}
            {data.entity && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)] text-[10px] uppercase">法人</span>
                <span className="text-[var(--text-primary)] text-xs">{data.entity}</span>
              </div>
            )}

            {/* Description / Note */}
            {data.description && (
              <div className="mt-1 text-[10px] text-[var(--text-muted)] italic border-t border-[var(--glass-border)] pt-2">
                {data.description}
              </div>
            )}

            {/* Entry ID — small reference */}
            {data.entry_id && (
              <div className="text-[9px] text-[var(--text-muted)] mt-1">
                REF: {data.entry_id}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="bg-[var(--glass-bg)] px-3 py-1.5 border-t border-[var(--glass-border)] text-[10px] text-[var(--text-muted)] flex justify-between">
        <span>會計稽核狀態</span>
        <span className="text-[var(--success)]">已驗證</span>
      </div>
    </div>
  );
}
