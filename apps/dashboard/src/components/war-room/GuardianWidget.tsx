'use client';

import React from 'react';

export interface GuardianWidgetProps {
  actionType: 'policy_summary' | 'booking_status' | 'coverage_check';
  data: {
    // policy_summary / booking_status
    policy_id?: string;
    policy_name?: string;
    insurer?: string;
    status?: string;
    ledger_linked?: boolean;
    annual_premium?: number;
    currency?: string;
    coverage_start?: string;
    coverage_end?: string;
    // coverage_check
    coverage_items?: Array<{ name: string; amount: number; unit?: string }>;
    note?: string;
    // booking_status
    booking_ref?: string;
    accountant_entry_id?: string;
    submitted_at?: string;
  };
}

const STATUS_COLOR: Record<string, string> = {
  active:    '#22c55e',
  pending:   '#f59e0b',
  cancelled: '#ef4444',
  expired:   '#6b7280',
};

export function GuardianWidget({ actionType, data }: GuardianWidgetProps) {
  const statusColor = STATUS_COLOR[data.status?.toLowerCase() ?? ''] ?? '#9ca3af';

  return (
    <div className="flex flex-col w-full max-w-sm mt-2 border border-[#0ea5e9]/30 bg-[#0d1117]/90 backdrop-blur-md rounded shadow-[0_0_15px_rgba(14,165,233,0.1)] overflow-hidden font-mono">
      {/* Header */}
      <div className="bg-[#161b22] px-3 py-1 border-b border-[#0ea5e9]/30 flex justify-between items-center">
        <span className="text-[#0ea5e9] text-xs font-bold tracking-widest uppercase">
          [ {actionType.replace(/_/g, ' ').toUpperCase()} ]
        </span>
        <span className="text-[#9ca3af] text-[10px] tracking-wider">SHIELD_GUARDIAN</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Policy Summary */}
        {actionType === 'policy_summary' && data && (
          <div className="flex flex-col gap-2 text-sm">
            {/* Policy name */}
            <div className="text-[#0ea5e9] font-bold text-sm border-b border-[#1e2a38] pb-1 truncate">
              {data.policy_name ?? '保單名稱未提供'}
            </div>

            {/* Insurer */}
            {data.insurer && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">保險公司</span>
                <span className="text-[#f5f5f5] text-xs">{data.insurer}</span>
              </div>
            )}

            {/* Status */}
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-[10px] uppercase">狀態</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: statusColor, border: `1px solid ${statusColor}40`, background: `${statusColor}10` }}>
                {data.status?.toUpperCase() ?? 'UNKNOWN'}
              </span>
            </div>

            {/* Ledger Linked Badge */}
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-[10px] uppercase">帳務連結</span>
              {data.ledger_linked ? (
                <span className="text-[10px] font-bold text-[#22c55e] border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-0.5 rounded">
                  ✓ LINKED
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#f59e0b] border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-2 py-0.5 rounded">
                  ○ PENDING
                </span>
              )}
            </div>

            {/* Annual Premium */}
            {data.annual_premium != null && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">年繳保費</span>
                <span className="text-[#f5f5f5] text-xs">
                  {data.annual_premium.toLocaleString()} {data.currency ?? 'NTD'}
                </span>
              </div>
            )}

            {/* Coverage Period */}
            {(data.coverage_start || data.coverage_end) && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">保障期間</span>
                <span className="text-[#f5f5f5] text-[10px]">
                  {data.coverage_start ?? '—'} → {data.coverage_end ?? '—'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Booking Status */}
        {actionType === 'booking_status' && data && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="text-[#0ea5e9] font-bold text-sm border-b border-[#1e2a38] pb-1">
              Auto-Booking 狀態
            </div>

            {data.booking_ref && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">預約單號</span>
                <span className="text-[#f5f5f5] text-xs">{data.booking_ref}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-[10px] uppercase">帳務連結</span>
              {data.ledger_linked ? (
                <span className="text-[10px] font-bold text-[#22c55e] border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-0.5 rounded">
                  ✓ LINKED TO LEDGER
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#f59e0b] border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-2 py-0.5 rounded animate-pulse">
                  ○ AWAITING ACCOUNTANT
                </span>
              )}
            </div>

            {data.accountant_entry_id && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">帳目 ID</span>
                <span className="text-[#f5f5f5] text-xs">{data.accountant_entry_id}</span>
              </div>
            )}

            {data.submitted_at && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-[10px] uppercase">提交時間</span>
                <span className="text-[#f5f5f5] text-xs">{new Date(data.submitted_at).toLocaleString('zh-TW')}</span>
              </div>
            )}
          </div>
        )}

        {/* Coverage Check */}
        {actionType === 'coverage_check' && data && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="text-[#0ea5e9] font-bold text-sm border-b border-[#1e2a38] pb-1">
              保障項目分析
            </div>

            {data.coverage_items?.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-xs">{item.name}</span>
                <span className="text-[#f5f5f5] text-xs">
                  {item.amount.toLocaleString()} {item.unit ?? 'NTD'}
                </span>
              </div>
            ))}

            {data.note && (
              <div className="mt-1 text-[10px] text-[#9ca3af] italic border-t border-[#1e2a38] pt-2">
                {data.note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#0d1117] px-3 py-1 border-t border-[#1e2a38] text-[10px] text-[#9ca3af] flex justify-between">
        <span>GUARDIAN COMPLIANCE</span>
        <span>SHIELD ACTIVE</span>
      </div>
    </div>
  );
}
