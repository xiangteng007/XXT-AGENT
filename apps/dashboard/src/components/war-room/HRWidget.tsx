'use client';

import React from 'react';

export interface HRWidgetProps {
  calculationType: 'salary' | 'leave' | 'insurance';
  data: any;
}

export function HRWidget({ calculationType, data }: HRWidgetProps) {
  return (
    <div className="flex flex-col w-full max-w-sm mt-2 border border-[#D97706]/30 bg-[#1a1a1a]/90 backdrop-blur-md rounded shadow-[0_0_15px_rgba(217,119,6,0.1)] overflow-hidden font-mono">
      <div className="bg-[#2d2d2d] px-3 py-1 border-b border-[#D97706]/30 flex justify-between items-center">
        <span className="text-[#D97706] text-xs font-bold tracking-widest uppercase">
          [ {calculationType.toUpperCase()} ]
        </span>
        <span className="text-[#9ca3af] text-[10px] tracking-wider">SECURE_HR</span>
      </div>
      <div className="p-4 space-y-3">
        {calculationType === 'salary' && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Base Salary</span>
              <span className="text-[#f5f5f5]">{data.baseSalary?.toLocaleString()} NTD</span>
            </div>
            {data.overtimePay > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-xs">Overtime Pay (+)</span>
                <span className="text-[#22c55e]">{data.overtimePay?.toLocaleString()} NTD</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Labor Insurance (-)</span>
              <span className="text-[#ef4444]">{data.laborInsurance?.toLocaleString()} NTD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Health Insurance (-)</span>
              <span className="text-[#ef4444]">{data.healthInsurance?.toLocaleString()} NTD</span>
            </div>
            {data.pension > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-xs">Pension Self-Cont. (-)</span>
                <span className="text-[#ef4444]">{data.pension?.toLocaleString()} NTD</span>
              </div>
            )}
            <div className="h-px bg-[#3d3d3d] w-full my-1"></div>
            <div className="flex justify-between items-center">
              <span className="text-[#D97706] text-xs font-bold">NET PAY</span>
              <span className="text-[#D97706] font-bold">{data.netPay?.toLocaleString()} NTD</span>
            </div>
          </div>
        )}
      </div>
      <div className="bg-[#1a1a1a] px-3 py-1 border-t border-[#3d3d3d] text-[10px] text-[#9ca3af] flex justify-between">
        <span>NOVA COMPLIANCE CHECK</span>
        <span>VERIFIED</span>
      </div>
    </div>
  );
}
