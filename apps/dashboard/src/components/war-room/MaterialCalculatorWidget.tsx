'use client';

import React from 'react';

export interface MaterialCalculatorWidgetProps {
  calculationType: 'stairVolume' | 'scaffolding' | 'coating';
  data: any;
}

export function MaterialCalculatorWidget({ calculationType, data }: MaterialCalculatorWidgetProps) {
  return (
    <div className="flex flex-col w-full mt-2 border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] rounded shadow-[0_0_15px_rgba(217,119,6,0.1)] overflow-hidden font-mono text-[var(--text-primary)]">
      <div className="bg-[var(--glass-bg)] px-3 py-1 border-b border-[var(--glass-border)] flex justify-between items-center">
        <span className="text-[var(--accent-primary)] text-xs font-bold tracking-widest uppercase">
          [ {calculationType === 'stairVolume' ? '樓梯混凝土量' : calculationType === 'scaffolding' ? '鷹架估算' : '塗料計算'} ]
        </span>
        <span className="text-[var(--text-muted)] text-[10px] tracking-wider">機密安全</span>
      </div>
      <div className="p-4 space-y-3">
        {calculationType === 'stairVolume' && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">混凝土體積</span>
              <span className="text-[var(--text-primary)] text-sm font-bold">{data.volume ? data.volume.toFixed(2) : data.toFixed(2)} m³</span>
            </div>
          </div>
        )}

        {calculationType === 'scaffolding' && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">垂直面積</span>
              <span className="text-[var(--text-primary)]">{data.verticalArea?.toFixed(2)} m²</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">租賃成本</span>
              <span className="text-[var(--text-primary)]">{data.rentalCost?.toLocaleString()} NTD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">安裝費用</span>
              <span className="text-[var(--text-primary)]">{data.installationCost?.toLocaleString()} NTD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">安全網</span>
              <span className="text-[var(--text-primary)]">{data.safetyNetCost?.toLocaleString()} NTD</span>
            </div>
            <div className="h-px bg-[var(--glass-border)] w-full my-1"></div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--accent-primary)] text-xs font-bold">總估算金額</span>
              <span className="text-[var(--accent-primary)] font-bold">{data.totalCost?.toLocaleString()} NTD</span>
            </div>
          </div>
        )}

        {calculationType === 'coating' && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">淨需求量</span>
              <span className="text-[var(--text-primary)]">{data.netRequirement?.toFixed(2)} {data.unit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">總量 (含損耗)</span>
              <span className="text-[var(--accent-primary)] font-bold">{data.grossRequirement?.toFixed(2)} {data.unit}</span>
            </div>
          </div>
        )}
      </div>
      <div className="bg-[var(--glass-bg)] px-3 py-1 border-t border-[var(--glass-border)] text-[10px] text-[var(--text-muted)] flex justify-between">
        <span>僅供估算參考</span>
        <span>版本: v2.0 // 機密</span>
      </div>
    </div>
  );
}
