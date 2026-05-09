'use client';

import React from 'react';

export interface HRWidgetProps {
  calculationType: 'salary' | 'leave' | 'insurance';
  data: any;
}

export function HRWidget({ calculationType, data }: HRWidgetProps) {
  return (
    <div className="flex flex-col w-full mt-2 border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] rounded shadow-[0_0_15px_rgba(217,119,6,0.1)] overflow-hidden font-mono text-[var(--text-primary)]">
      <div className="bg-[var(--glass-bg)] px-3 py-1 border-b border-[var(--glass-border)] flex justify-between items-center">
        <span className="text-[var(--accent-primary)] text-xs font-bold tracking-widest uppercase">
          [ {calculationType === 'salary' ? '薪資結算' : calculationType === 'leave' ? '差勤管理' : '保險給付'} ]
        </span>
        <span className="text-[var(--text-muted)] text-[10px] tracking-wider">機密_人資</span>
      </div>
      <div className="p-4 space-y-3">
        {calculationType === 'salary' && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">底薪</span>
              <span className="text-[var(--text-primary)]">{data.baseSalary?.toLocaleString()} NTD</span>
            </div>
            {data.overtimePay > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)] text-xs">加班費 (+)</span>
                <span className="text-[var(--success)]">{data.overtimePay?.toLocaleString()} NTD</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">勞工保險 (-)</span>
              <span className="text-[var(--danger)]">{data.laborInsurance?.toLocaleString()} NTD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">健康保險 (-)</span>
              <span className="text-[var(--danger)]">{data.healthInsurance?.toLocaleString()} NTD</span>
            </div>
            {data.pension > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)] text-xs">勞退自提 (-)</span>
                <span className="text-[var(--danger)]">{data.pension?.toLocaleString()} NTD</span>
              </div>
            )}
            <div className="h-px bg-[var(--glass-border)] w-full my-1"></div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--accent-primary)] text-xs font-bold">實發薪資</span>
              <span className="text-[var(--accent-primary)] font-bold">{data.netPay?.toLocaleString()} NTD</span>
            </div>
          </div>
        )}
      </div>
      <div className="bg-[var(--glass-bg)] px-3 py-1 border-t border-[var(--glass-border)] text-[10px] text-[var(--text-muted)] flex justify-between">
        <span>NOVA 合規檢查</span>
        <span className="text-[var(--success)]">已驗證</span>
      </div>
    </div>
  );
}
