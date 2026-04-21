'use client';

import React from 'react';

export interface MaterialCalculatorWidgetProps {
  calculationType: 'stairVolume' | 'scaffolding' | 'coating';
  data: any;
}

export function MaterialCalculatorWidget({ calculationType, data }: MaterialCalculatorWidgetProps) {
  return (
    <div className="flex flex-col w-full max-w-sm mt-2 border border-[#D97706]/30 bg-[#1a1a1a]/90 backdrop-blur-md rounded shadow-[0_0_15px_rgba(217,119,6,0.1)] overflow-hidden font-mono">
      <div className="bg-[#2d2d2d] px-3 py-1 border-b border-[#D97706]/30 flex justify-between items-center">
        <span className="text-[#D97706] text-xs font-bold tracking-widest uppercase">
          [ {calculationType.replace(/([A-Z])/g, ' $1').trim()} ]
        </span>
        <span className="text-[#9ca3af] text-[10px] tracking-wider">SECURE</span>
      </div>
      <div className="p-4 space-y-3">
        {calculationType === 'stairVolume' && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Concrete Volume</span>
              <span className="text-[#f5f5f5] text-sm font-bold">{data.volume ? data.volume.toFixed(2) : data.toFixed(2)} m³</span>
            </div>
          </div>
        )}

        {calculationType === 'scaffolding' && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Vertical Area</span>
              <span className="text-[#f5f5f5]">{data.verticalArea?.toFixed(2)} m²</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Rental Cost</span>
              <span className="text-[#f5f5f5]">{data.rentalCost?.toLocaleString()} NTD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Installation</span>
              <span className="text-[#f5f5f5]">{data.installationCost?.toLocaleString()} NTD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Safety Net</span>
              <span className="text-[#f5f5f5]">{data.safetyNetCost?.toLocaleString()} NTD</span>
            </div>
            <div className="h-px bg-[#3d3d3d] w-full my-1"></div>
            <div className="flex justify-between items-center">
              <span className="text-[#D97706] text-xs font-bold">TOTAL ESTIMATE</span>
              <span className="text-[#D97706] font-bold">{data.totalCost?.toLocaleString()} NTD</span>
            </div>
          </div>
        )}

        {calculationType === 'coating' && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Net Requirement</span>
              <span className="text-[#f5f5f5]">{data.netRequirement?.toFixed(2)} {data.unit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#9ca3af] text-xs">Gross (with Wastage)</span>
              <span className="text-[#D97706] font-bold">{data.grossRequirement?.toFixed(2)} {data.unit}</span>
            </div>
          </div>
        )}
      </div>
      <div className="bg-[#1a1a1a] px-3 py-1 border-t border-[#3d3d3d] text-[10px] text-[#9ca3af] flex justify-between">
        <span>ESTIMATE ONLY</span>
        <span>VERSION: v2.0 // CLASSIFIED</span>
      </div>
    </div>
  );
}
