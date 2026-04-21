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
    <div className="flex flex-col w-full max-w-sm mt-2 border border-[#D97706]/30 bg-[#1a1a1a]/90 backdrop-blur-md rounded shadow-[0_0_15px_rgba(217,119,6,0.1)] overflow-hidden font-mono">
      <div className="bg-[#2d2d2d] px-3 py-1 border-b border-[#D97706]/30 flex justify-between items-center">
        <span className="text-[#D97706] text-xs font-bold tracking-widest uppercase">
          [ {actionType.replace(/_/g, ' ').toUpperCase()} ]
        </span>
        <span className="text-[#9ca3af] text-[10px] tracking-wider">KAY_ACCOUNTING</span>
      </div>
      <div className="p-4 space-y-3">
        {actionType === 'tax_plan' && data && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center text-[#D97706] font-bold border-b border-[#3d3d3d] pb-1">
              <span>Tax Year</span>
              <span>{data.year}</span>
            </div>
            
            <div className="flex justify-between items-center mt-2">
              <span className="text-[#9ca3af] text-xs">Total Deductibles</span>
              <span className="text-[#22c55e]">{data.total_deductible?.toLocaleString()} NTD</span>
            </div>

            {data.deductions && data.deductions.map((d, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">{d.category}</span>
                <span className="text-[#f5f5f5] text-xs">{d.claimable?.toLocaleString()} / {d.limit?.toLocaleString()}</span>
              </div>
            ))}
            
            <div className="text-[10px] text-[#ef4444] mt-2 italic">
              * {data.note || 'Estimate only'}
            </div>
          </div>
        )}

        {actionType === 'bank_summary' && data && (
          <div className="flex flex-col gap-2 text-sm">
             <div className="flex justify-between items-center text-[#D97706] font-bold border-b border-[#3d3d3d] pb-1">
              <span>Grand Total</span>
              <span>{data.grand_total_twd?.toLocaleString()} NTD</span>
            </div>
            {data.by_entity?.map((ent, i) => (
              <div key={i} className="flex justify-between items-center mt-1">
                <span className="text-[#9ca3af] text-xs">{ent.entity_label}</span>
                <span className="text-[#f5f5f5]">{ent.total_balance?.toLocaleString()} NTD</span>
              </div>
            ))}
          </div>
        )}

        {actionType === 'bank_transaction' && data && (
          <div className="flex flex-col gap-2 text-sm">
            {/* Amount — color-coded by transaction type */}
            <div className="flex justify-between items-center border-b border-[#3d3d3d] pb-2">
              <span className="text-[#9ca3af] text-xs uppercase tracking-wider">
                {data.type === 'income' ? '▲ 收入' : '▼ 支出'}
              </span>
              <span className={`text-lg font-bold ${data.type === 'income' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {data.type === 'expense' ? '-' : '+'}{data.amount?.toLocaleString()} {data.currency ?? 'NTD'}
              </span>
            </div>

            {/* Date */}
            {data.date && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">日期</span>
                <span className="text-[#f5f5f5] text-xs">{data.date}</span>
              </div>
            )}

            {/* Category */}
            {data.category && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">類別</span>
                <span className="text-[#D97706] text-xs">{data.category}</span>
              </div>
            )}

            {/* Entity */}
            {data.entity && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">法人</span>
                <span className="text-[#f5f5f5] text-xs">{data.entity}</span>
              </div>
            )}

            {/* Description / Note */}
            {data.description && (
              <div className="mt-1 text-[10px] text-[#9ca3af] italic border-t border-[#3d3d3d] pt-2">
                {data.description}
              </div>
            )}

            {/* Entry ID — small reference */}
            {data.entry_id && (
              <div className="text-[9px] text-[#4b5563] mt-1">
                REF: {data.entry_id}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="bg-[#1a1a1a] px-3 py-1 border-t border-[#3d3d3d] text-[10px] text-[#9ca3af] flex justify-between">
        <span>ACCOUNTANT COMPLIANCE</span>
        <span>VERIFIED</span>
      </div>
    </div>
  );
}
