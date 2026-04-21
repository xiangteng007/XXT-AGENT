'use client';

import React, { useState } from 'react';

export default function NasDashboardPage() {
  const [deployStatus, setDeployStatus] = useState<string>('Idle');

  const handleDeploy = () => {
    setDeployStatus('Deploying... Establishing SSH Tunnel');
    setTimeout(() => {
      setDeployStatus('Deploying... Pulling ChromaDB & Postgres Images');
      setTimeout(() => {
        setDeployStatus('Active - Argus Memory Core Online');
      }, 2000);
    }, 1500);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-4">Infrastructure Control Center</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NAS Health Card */}
        <div className="p-6 border rounded-xl shadow-sm bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">ASUSTOR AS5404T Health</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Connection Status</span>
              <span className="text-green-500 font-medium">● Connected (ADM API)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">CPU Temp</span>
              <span className="font-medium">45.2°C</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Volume 1 Usage</span>
              <div className="w-1/2 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '51%' }}></div>
              </div>
              <span className="font-medium ml-2">8.2TB / 16TB</span>
            </div>
          </div>
        </div>

        {/* Argus Memory Docker Cluster */}
        <div className="p-6 border rounded-xl shadow-sm bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Argus Long-Term Memory (Docker)</h2>
          <div className="space-y-4">
             <div className="flex justify-between items-center">
              <span className="text-gray-500">Cluster Status</span>
              <span className={`font-medium ${deployStatus.includes('Active') ? 'text-green-500' : 'text-amber-500'}`}>
                {deployStatus}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Vector DB (Chroma)</span>
              <span className="font-medium">8000/tcp</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Relational Store (Postgres)</span>
              <span className="font-medium">5432/tcp</span>
            </div>
            
            <button 
              onClick={handleDeploy}
              disabled={deployStatus.includes('Active') || deployStatus.includes('Deploying')}
              className="w-full mt-4 bg-copper text-white py-2 rounded-lg hover:bg-copper-dark transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#B87333' }}
            >
              {deployStatus.includes('Active') ? 'Cluster Operational' : 'Deploy Memory Core to AS5404T'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
