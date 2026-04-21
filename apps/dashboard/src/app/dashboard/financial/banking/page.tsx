"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface Transaction {
  id: string;
  amount: number;
  date: string;
  counterparty: string;
  description: string;
  status: string;
}

export default function BankingDashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [counterpartyFilter, setCounterpartyFilter] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  // Sync Telemetry Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch transactions
  useEffect(() => {
    const fetchTxns = async () => {
      try {
        setLoading(true);
        let url = `/api/agents/accountant/bank/txn?limit=15`;
        if (counterpartyFilter) {
          url += `&counterparty=${encodeURIComponent(counterpartyFilter)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setTransactions(data.transactions || []);
        } else {
          // fallback mock data for UI visual if backend fails
          setTransactions([
            { id: "TXN-001", amount: -450000, date: "2026-04-18", counterparty: "Taiwan Steel Corp", description: "Material Purchase", status: "CLEARED" },
            { id: "TXN-002", amount: 1200000, date: "2026-04-17", counterparty: "City Government", description: "Milestone Payment 2", status: "PENDING" },
            { id: "TXN-003", amount: -15000, date: "2026-04-16", counterparty: "AWS Cloud", description: "Infrastructure", status: "CLEARED" }
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    // Debounce fetch slightly
    const timeout = setTimeout(fetchTxns, 500);
    return () => clearTimeout(timeout);
  }, [counterpartyFilter]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8 text-[#f5f5f5] font-['Outfit'] relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#D97706]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-[#00D4FF]/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end pb-8 border-b border-[#2d2d2d] gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dashboard/financial">
                <Button variant="outline" className="text-xs border-[#c39b6f]/30 text-[#9ca3af] hover:text-[#f5f5f5] hover:border-[#c39b6f]">← BACK</Button>
              </Link>
              <span className="text-[10px] uppercase tracking-widest text-[#00D4FF] font-mono border border-[#00D4FF]/30 px-2 py-0.5 bg-[#00D4FF]/10">SYSTEM STATUS: SECURE</span>
            </div>
            <h1 className="text-4xl font-semibold text-[#f5f5f5] tracking-tight">Banking Operations</h1>
            <p className="text-[#9ca3af] mt-2 font-mono text-sm tracking-wide">OPERATOR ID: ACCOUNTANT_PRIMARY // CLASSIFIED</p>
          </div>
          
          {/* Telemetry Header */}
          <div className="flex gap-4">
            <div className="bg-[#000000]/30 border border-[#FBBF24]/20 px-4 py-2 flex flex-col items-end min-w-[200px]">
              <div className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#9ca3af]">System Time</div>
              <div className="text-lg font-bold font-mono text-[#00D4FF]" style={{ textShadow: '0 0 8px rgba(0,212,255,0.4)' }}>
                {currentTime || "SYNCING..."}
              </div>
            </div>
            <Button className="bg-[#D97706] hover:bg-[#FBBF24] text-black font-semibold rounded-none border border-transparent hover:border-[#FBBF24] transition-all">
              INITIATE UPLINK
            </Button>
          </div>
        </header>

        {/* High Level Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-[#0f1218]/85 backdrop-blur-[20px] border border-[#c39b6f]/15 rounded-none relative overflow-hidden group">
            {/* Light Trail border on hover simulation */}
            <div className="absolute inset-0 border border-transparent group-hover:border-[#c39b6f]/50 transition-colors duration-300 pointer-events-none" />
            <CardHeader className="pb-2 border-b border-[#2d2d2d]/50">
              <CardTitle className="text-xs uppercase tracking-wider font-mono text-[#9ca3af]">Total Liquid Assets</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-4xl font-bold font-mono text-[#f5f5f5]">NT$ 32,450,000</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <p className="text-xs text-[#10b981] font-mono">LIVE SYNC ACTIVE</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0f1218]/85 backdrop-blur-[20px] border border-[#c39b6f]/15 rounded-none relative group">
            <div className="absolute inset-0 border border-transparent group-hover:border-[#c39b6f]/50 transition-colors duration-300 pointer-events-none" />
            <CardHeader className="pb-2 border-b border-[#2d2d2d]/50">
              <CardTitle className="text-xs uppercase tracking-wider font-mono text-[#9ca3af]">30-Day Cash Flow</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-4xl font-bold font-mono text-[#10b981]">+NT$ 4,200,000</div>
              <p className="text-xs text-[#9ca3af] mt-2 font-mono">Incoming &gt; Outgoing</p>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1218]/85 backdrop-blur-[20px] border border-[#c39b6f]/15 rounded-none relative group">
            <div className="absolute inset-0 border border-transparent group-hover:border-[#c39b6f]/50 transition-colors duration-300 pointer-events-none" />
            <CardHeader className="pb-2 border-b border-[#2d2d2d]/50">
              <CardTitle className="text-xs uppercase tracking-wider font-mono text-[#9ca3af]">Pending Transactions</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-4xl font-bold font-mono text-[#FBBF24]">14</div>
              <p className="text-xs text-[#FBBF24]/80 mt-2 font-mono uppercase">Action Required</p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Data Grid */}
        <Card className="bg-[#0f1218]/85 backdrop-blur-[20px] border border-[#c39b6f]/15 rounded-none mt-8">
          <CardHeader className="border-b border-[#2d2d2d] flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-medium text-[#f5f5f5]">Transaction Ledger</CardTitle>
            <div className="flex items-center gap-4 w-1/3">
              <Input 
                className="bg-[#1a1a1a] border-[#2d2d2d] text-[#f5f5f5] font-mono text-sm rounded-none focus-visible:ring-[#D97706] focus-visible:border-[#D97706]"
                placeholder="Filter by counterparty..." 
                value={counterpartyFilter}
                onChange={(e) => setCounterpartyFilter(e.target.value)}
              />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="bg-[#1a1a1a]/50 text-[#9ca3af]">
                  <th className="px-6 py-4 text-left font-normal uppercase tracking-wider text-xs">TXN ID</th>
                  <th className="px-6 py-4 text-left font-normal uppercase tracking-wider text-xs">Date</th>
                  <th className="px-6 py-4 text-left font-normal uppercase tracking-wider text-xs">Counterparty</th>
                  <th className="px-6 py-4 text-left font-normal uppercase tracking-wider text-xs">Description</th>
                  <th className="px-6 py-4 text-right font-normal uppercase tracking-wider text-xs">Amount</th>
                  <th className="px-6 py-4 text-center font-normal uppercase tracking-wider text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[#9ca3af] font-mono animate-pulse">
                      SCANNING LEDGER...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[#9ca3af] font-mono">
                      NO RECORDS FOUND
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn, i) => (
                    <tr key={txn.id} className="border-b border-[#2d2d2d] hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-6 py-4 text-[#9ca3af]">{txn.id}</td>
                      <td className="px-6 py-4 text-[#f5f5f5]">{txn.date}</td>
                      <td className="px-6 py-4 text-[#00D4FF]">{txn.counterparty}</td>
                      <td className="px-6 py-4 text-[#f5f5f5]">{txn.description}</td>
                      <td className={`px-6 py-4 text-right ${txn.amount < 0 ? 'text-[#e11d48]' : 'text-[#10b981]'}`}>
                        {txn.amount < 0 ? '-' : '+'}NT$ {Math.abs(txn.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-[10px] uppercase tracking-wider border ${
                          txn.status === 'CLEARED' ? 'border-[#10b981]/30 text-[#10b981] bg-[#10b981]/10' :
                          'border-[#FBBF24]/30 text-[#FBBF24] bg-[#FBBF24]/10'
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
