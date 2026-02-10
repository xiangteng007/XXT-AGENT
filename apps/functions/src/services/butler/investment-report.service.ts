/**
 * Investment Report Service
 * Generates a print-friendly HTML report for investment portfolio
 * Users can save as PDF via browser's Print > Save as PDF
 */

import { getFirestore } from 'firebase-admin/firestore';

interface Holding {
    symbol: string;
    name: string;
    shares: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    returnRate: number;
    type: string;
}

interface LoanRecord {
    lender: string;
    amount: number;
    remainingBalance: number;
    monthlyPayment: number;
    interestRate: number;
    dueDate: string;
}

export async function generateInvestmentReport(uid: string): Promise<string> {
    const db = getFirestore();

    // Fetch investment holdings
    const holdingsSnap = await db.collection('users').doc(uid)
        .collection('investments').get();
    const holdings: Holding[] = holdingsSnap.docs.map(doc => {
        const d = doc.data();
        const marketValue = (d.shares || 0) * (d.currentPrice || d.avgCost || 0);
        const cost = (d.shares || 0) * (d.avgCost || 0);
        const pnl = marketValue - cost;
        return {
            symbol: d.symbol || doc.id,
            name: d.name || d.symbol || doc.id,
            shares: d.shares || 0,
            avgCost: d.avgCost || 0,
            currentPrice: d.currentPrice || d.avgCost || 0,
            marketValue,
            unrealizedPnL: pnl,
            returnRate: cost > 0 ? (pnl / cost) * 100 : 0,
            type: d.type || '股票',
        };
    });

    // Fetch loans
    const loansSnap = await db.collection('users').doc(uid)
        .collection('loans').get();
    const loans: LoanRecord[] = loansSnap.docs.map(doc => {
        const d = doc.data();
        return {
            lender: d.lender || d.bank || '未知',
            amount: d.amount || 0,
            remainingBalance: d.remainingBalance || d.amount || 0,
            monthlyPayment: d.monthlyPayment || 0,
            interestRate: d.interestRate || 0,
            dueDate: d.dueDate || '',
        };
    });

    // Calculate totals
    const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0);
    const totalCost = holdings.reduce((s, h) => s + h.shares * h.avgCost, 0);
    const totalPnL = totalMarketValue - totalCost;
    const totalReturnRate = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
    const totalLoanBalance = loans.reduce((s, l) => s + l.remainingBalance, 0);
    const totalMonthlyPayment = loans.reduce((s, l) => s + l.monthlyPayment, 0);
    const netWorth = totalMarketValue - totalLoanBalance;

    const now = new Date();
    const reportDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    // Allocation by type
    const typeMap: Record<string, number> = {};
    holdings.forEach(h => {
        typeMap[h.type] = (typeMap[h.type] || 0) + h.marketValue;
    });

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>投資組合報告 — ${reportDate}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .summary-card { background: #f8f9fa; border-radius: 12px; padding: 16px; text-align: center; }
  .summary-card .label { font-size: 12px; color: #888; margin-bottom: 4px; }
  .summary-card .value { font-size: 22px; font-weight: 700; }
  .positive { color: #10b981; }
  .negative { color: #ef4444; }
  .neutral { color: #3b82f6; }
  h2 { font-size: 18px; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
  th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
  tr:hover { background: #fafafa; }
  .text-right { text-align: right; }
  .allocation-bar { display: flex; height: 24px; border-radius: 12px; overflow: hidden; margin: 12px 0; }
  .allocation-segment { height: 100%; }
  .allocation-legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 4px; vertical-align: middle; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #999; font-size: 11px; text-align: center; }
</style>
</head>
<body>
<h1>📊 投資組合報告</h1>
<div class="subtitle">報告日期：${reportDate} ｜ XXT-AGENT Personal Butler</div>

<div class="summary-grid">
  <div class="summary-card">
    <div class="label">總市值</div>
    <div class="value neutral">$${totalMarketValue.toLocaleString()}</div>
  </div>
  <div class="summary-card">
    <div class="label">未實現損益</div>
    <div class="value ${totalPnL >= 0 ? 'positive' : 'negative'}">${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString()}</div>
  </div>
  <div class="summary-card">
    <div class="label">報酬率</div>
    <div class="value ${totalReturnRate >= 0 ? 'positive' : 'negative'}">${totalReturnRate.toFixed(2)}%</div>
  </div>
  <div class="summary-card">
    <div class="label">淨資產</div>
    <div class="value ${netWorth >= 0 ? 'positive' : 'negative'}">$${netWorth.toLocaleString()}</div>
  </div>
</div>

${holdings.length > 0 ? `
<h2>📈 持倉明細（${holdings.length} 檔）</h2>
<table>
  <thead>
    <tr>
      <th>代號</th><th>名稱</th><th>類型</th>
      <th class="text-right">股數</th><th class="text-right">均價</th>
      <th class="text-right">現價</th><th class="text-right">市值</th>
      <th class="text-right">損益</th><th class="text-right">報酬率</th>
    </tr>
  </thead>
  <tbody>
    ${holdings.sort((a, b) => b.marketValue - a.marketValue).map(h => `
    <tr>
      <td><strong>${h.symbol}</strong></td>
      <td>${h.name}</td>
      <td>${h.type}</td>
      <td class="text-right">${h.shares.toLocaleString()}</td>
      <td class="text-right">$${h.avgCost.toLocaleString()}</td>
      <td class="text-right">$${h.currentPrice.toLocaleString()}</td>
      <td class="text-right">$${h.marketValue.toLocaleString()}</td>
      <td class="text-right ${h.unrealizedPnL >= 0 ? 'positive' : 'negative'}">${h.unrealizedPnL >= 0 ? '+' : ''}$${h.unrealizedPnL.toLocaleString()}</td>
      <td class="text-right ${h.returnRate >= 0 ? 'positive' : 'negative'}">${h.returnRate.toFixed(2)}%</td>
    </tr>`).join('')}
  </tbody>
</table>

${Object.keys(typeMap).length > 1 ? `
<h2>🎯 資產配置</h2>
<div class="allocation-bar">
  ${Object.entries(typeMap).map(([type, val], i) => {
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
        const pct = totalMarketValue > 0 ? (val / totalMarketValue) * 100 : 0;
        return `<div class="allocation-segment" style="width:${pct}%;background:${colors[i % colors.length]}"></div>`;
    }).join('')}
</div>
<div class="allocation-legend">
  ${Object.entries(typeMap).map(([type, val], i) => {
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
        const pct = totalMarketValue > 0 ? (val / totalMarketValue) * 100 : 0;
        return `<span><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${type} $${val.toLocaleString()} (${pct.toFixed(1)}%)</span>`;
    }).join('')}
</div>
` : ''}
` : '<p style="color:#888;text-align:center;padding:20px;">尚無投資持倉資料</p>'}

${loans.length > 0 ? `
<h2>🏦 貸款明細（${loans.length} 筆）</h2>
<table>
  <thead>
    <tr>
      <th>銀行/機構</th><th class="text-right">原始金額</th>
      <th class="text-right">剩餘本金</th><th class="text-right">月付金</th>
      <th class="text-right">利率</th><th>到期日</th>
    </tr>
  </thead>
  <tbody>
    ${loans.map(l => `
    <tr>
      <td>${l.lender}</td>
      <td class="text-right">$${l.amount.toLocaleString()}</td>
      <td class="text-right">$${l.remainingBalance.toLocaleString()}</td>
      <td class="text-right">$${l.monthlyPayment.toLocaleString()}</td>
      <td class="text-right">${l.interestRate}%</td>
      <td>${l.dueDate || '—'}</td>
    </tr>`).join('')}
    <tr style="font-weight:700;border-top:2px solid #e2e8f0">
      <td>合計</td>
      <td></td>
      <td class="text-right">$${totalLoanBalance.toLocaleString()}</td>
      <td class="text-right">$${totalMonthlyPayment.toLocaleString()}/月</td>
      <td></td><td></td>
    </tr>
  </tbody>
</table>
` : ''}

<div class="footer">
  此報告由 XXT-AGENT Personal Butler 自動生成 ｜ ${reportDate} ｜ 列印此頁可儲存為 PDF
</div>
</body>
</html>`;
}
