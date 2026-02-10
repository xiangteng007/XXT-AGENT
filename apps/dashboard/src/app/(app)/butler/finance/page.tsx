'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ================================
// Types
// ================================
interface FinanceData {
    monthlyIncome: number;
    monthlyExpenses: number;
    netSavings: number;
    savingsRate: number;
    recent: Array<{ id: string; description: string; amount: number; type: string; category: string; date: string }>;
    byCategory: Record<string, number>;
}
interface InvestmentData {
    holdings: Array<{ id: string; symbol: string; name: string; type: string; shares: number; avgCost: number; marketValue?: number; unrealizedPnL?: number }>;
    totalMarketValue: number;
    totalUnrealizedPnL: number;
    returnRate: number;
    holdingCount: number;
    allocation: Array<{ type: string; label: string; value: number; percentage: number }>;
}
interface LoanData {
    loans: Array<{ id: string; name: string; type: string; lender: string; principal: number; interestRate: number; monthlyPayment: number; remainingBalance: number }>;
    totalRemainingBalance: number;
    totalMonthlyPayment: number;
    paidOffPercentage: number;
    loanCount: number;
}
interface TaxData {
    hasProfile: boolean;
    year: number;
    estimation: { grossIncome: number; taxableIncome: number; taxBracketRate: number; estimatedTax: number; effectiveRate: number } | null;
}

type TabId = 'spending' | 'investment' | 'loan' | 'tax' | 'advisor';

export default function FinancePage() {
    const [activeTab, setActiveTab] = useState<TabId>('spending');
    const [loading, setLoading] = useState(true);
    const [finance, setFinance] = useState<FinanceData | null>(null);
    const [investment, setInvestment] = useState<InvestmentData | null>(null);
    const [loan, setLoan] = useState<LoanData | null>(null);
    const [tax, setTax] = useState<TaxData | null>(null);

    const tabs: { id: TabId; label: string; icon: string }[] = [
        { id: 'spending', label: '收支', icon: '💰' },
        { id: 'investment', label: '投資', icon: '📈' },
        { id: 'loan', label: '貸款', icon: '🏦' },
        { id: 'tax', label: '稅務', icon: '📋' },
        { id: 'advisor', label: '顧問', icon: '🤖' },
    ];

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                if (activeTab === 'spending' && !finance) {
                    const res = await fetch('/api/butler/finance');
                    if (res.ok) setFinance(await res.json());
                } else if (activeTab === 'investment' && !investment) {
                    const res = await fetch('/api/butler/investment');
                    if (res.ok) setInvestment(await res.json());
                } else if (activeTab === 'loan' && !loan) {
                    const res = await fetch('/api/butler/loan');
                    if (res.ok) setLoan(await res.json());
                } else if (activeTab === 'tax' && !tax) {
                    const res = await fetch('/api/butler/tax');
                    if (res.ok) setTax(await res.json());
                }
            } catch (e) { console.error('Load error:', e); }
            setLoading(false);
        }
        load();
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">💰 Finance Management</h1>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
                {tabs.map(tab => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab(tab.id)}
                        className="flex-1"
                    >
                        {tab.icon} {tab.label}
                    </Button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : (
                <>
                    {activeTab === 'spending' && <SpendingTab data={finance} />}
                    {activeTab === 'investment' && <InvestmentTab data={investment} />}
                    {activeTab === 'loan' && <LoanTab data={loan} />}
                    {activeTab === 'tax' && <TaxTab data={tax} />}
                    {activeTab === 'advisor' && <AdvisorTab />}
                </>
            )}
        </div>
    );
}

// ================================
// Spending Tab (original)
// ================================
function SpendingTab({ data }: { data: FinanceData | null }) {
    if (!data || (data.monthlyIncome === 0 && data.monthlyExpenses === 0)) {
        return <EmptyState icon="💰" msg="尚無交易記錄" hint="在 LINE 輸入「記 500 午餐」開始記帳" />;
    }
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="月收入" value={`$${data.monthlyIncome.toLocaleString()}`} color="text-green-500" />
                <StatCard label="月支出" value={`$${data.monthlyExpenses.toLocaleString()}`} color="text-red-500" />
                <StatCard label="淨存款" value={`$${data.netSavings.toLocaleString()}`} color={data.netSavings >= 0 ? 'text-green-500' : 'text-red-500'} />
                <StatCard label="儲蓄率" value={`${data.savingsRate}%`} color="text-blue-500" />
            </div>
            {/* Donut Chart */}
            {Object.keys(data.byCategory || {}).length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-sm">📊 支出分佈</CardTitle></CardHeader>
                    <CardContent>
                        <DonutChart data={data.byCategory} total={data.monthlyExpenses} />
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader><CardTitle className="text-sm">分類支出</CardTitle></CardHeader>
                <CardContent>
                    {Object.keys(data.byCategory || {}).length > 0 ? (
                        <div className="space-y-2">
                            {Object.entries(data.byCategory)
                                .sort(([, a], [, b]) => b - a)
                                .map(([cat, amt]) => (
                                    <div key={cat} className="flex justify-between items-center">
                                        <span className="text-sm">{cat}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                                {/* eslint-disable-next-line react/forbid-dom-props */}
                                                <div className="h-full bg-primary rounded-full"
                                                    style={{ width: `${Math.min(100, (amt / data.monthlyExpenses) * 100)}%` }} />
                                            </div>
                                            <span className="text-sm font-mono">${amt.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : <p className="text-sm text-muted-foreground">尚無分類資料</p>}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="text-sm">近期交易</CardTitle></CardHeader>
                <CardContent>
                    {data.recent?.length > 0 ? (
                        <div className="space-y-2">
                            {data.recent.slice(0, 10).map(tx => (
                                <div key={tx.id} className="flex justify-between items-center text-sm">
                                    <div>
                                        <span>{tx.description}</span>
                                        <Badge variant="outline" className="ml-2 text-xs">{tx.category}</Badge>
                                    </div>
                                    <span className={tx.type === 'income' ? 'text-green-500' : 'text-red-500'}>
                                        {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-muted-foreground">尚無交易</p>}
                </CardContent>
            </Card>
        </div>
    );
}

// ================================
// Investment Tab
// ================================
function InvestmentTab({ data }: { data: InvestmentData | null }) {
    if (!data || data.holdingCount === 0) {
        return <EmptyState icon="📈" msg="尚未建立投資組合" hint="在 LINE 輸入「買了 10 張 0050，均價 150」開始追蹤" />;
    }
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="總市值" value={`$${data.totalMarketValue.toLocaleString()}`} color="text-blue-500" />
                <StatCard label="未實現損益" value={`${data.totalUnrealizedPnL >= 0 ? '+' : ''}$${data.totalUnrealizedPnL.toLocaleString()}`} color={data.totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'} />
                <StatCard label="報酬率" value={`${data.returnRate}%`} color={data.returnRate >= 0 ? 'text-green-500' : 'text-red-500'} />
                <StatCard label="持倉數" value={`${data.holdingCount} 檔`} color="text-purple-500" />
            </div>

            {/* Asset Allocation */}
            <Card>
                <CardHeader><CardTitle className="text-sm">資產配置</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-3 flex-wrap">
                        {data.allocation.map(a => (
                            <Badge key={a.type} variant="outline">
                                {a.label} {a.percentage}%
                            </Badge>
                        ))}
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                        {data.allocation.map((a, i) => {
                            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];
                            // eslint-disable-next-line react/forbid-dom-props
                            return <div key={a.type} className={`h-full ${colors[i % colors.length]}`} style={{ width: `${a.percentage}%` }} />;
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Holdings Table */}
            <Card>
                <CardHeader><CardTitle className="text-sm">持倉列表</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {data.holdings.map(h => (
                            <div key={h.id} className="flex justify-between items-center text-sm p-2 rounded bg-muted/30">
                                <div>
                                    <span className="font-medium">{h.symbol}</span>
                                    <span className="text-muted-foreground ml-2">{h.name}</span>
                                </div>
                                <div className="text-right">
                                    <div>{h.shares} 股 × ${h.avgCost}</div>
                                    <div className={`text-xs ${(h.unrealizedPnL || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {(h.unrealizedPnL || 0) >= 0 ? '+' : ''}${(h.unrealizedPnL || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ================================
// Loan Tab
// ================================
function LoanTab({ data }: { data: LoanData | null }) {
    if (!data || data.loanCount === 0) {
        return <EmptyState icon="🏦" msg="無貸款記錄" hint="在 LINE 輸入「房貸試算 800萬 利率2.1% 30年」開始" />;
    }
    const loanTypeLabels: Record<string, string> = {
        mortgage: '房貸', car: '車貸', personal: '信貸', student: '學貸', credit: '卡債',
    };
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="貸款筆數" value={`${data.loanCount}筆`} color="text-orange-500" />
                <StatCard label="剩餘本金" value={`$${data.totalRemainingBalance.toLocaleString()}`} color="text-red-500" />
                <StatCard label="每月還款" value={`$${data.totalMonthlyPayment.toLocaleString()}`} color="text-blue-500" />
                <StatCard label="已還清" value={`${data.paidOffPercentage}%`} color="text-green-500" />
            </div>

            {data.loans.map(l => (
                <Card key={l.id}>
                    <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-medium">{l.name}</h3>
                                <Badge variant="outline" className="text-xs">{loanTypeLabels[l.type] || l.type}</Badge>
                                <span className="text-xs text-muted-foreground ml-2">{l.lender}</span>
                            </div>
                            <div className="text-right text-sm">
                                <div>利率 {l.interestRate}%</div>
                                <div className="text-muted-foreground">月付 ${l.monthlyPayment.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>已還 ${(l.principal - l.remainingBalance).toLocaleString()}</span>
                                <span>剩餘 ${l.remainingBalance.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full transition-all"
                                    style={{ width: `${Math.round((l.principal - l.remainingBalance) / l.principal * 100)}%` }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ================================
// Tax Tab
// ================================
function TaxTab({ data }: { data: TaxData | null }) {
    if (!data || !data.hasProfile || !data.estimation) {
        return <EmptyState icon="📋" msg="尚未設定稅務資料" hint="在 LINE 輸入「我年薪 120 萬，估算稅額」" />;
    }
    const est = data.estimation;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="綜合所得" value={`$${est.grossIncome.toLocaleString()}`} color="text-blue-500" />
                <StatCard label="應稅所得" value={`$${est.taxableIncome.toLocaleString()}`} color="text-purple-500" />
                <StatCard label="預估稅額" value={`$${est.estimatedTax.toLocaleString()}`} color="text-red-500" />
                <StatCard label="有效稅率" value={`${est.effectiveRate}%`} color="text-orange-500" />
            </div>

            <Card>
                <CardHeader><CardTitle className="text-sm">稅率級距 ({data.year})</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[
                            { bracket: '0 ~ 59 萬', rate: '5%', active: est.taxBracketRate === 5 },
                            { bracket: '59 ~ 133 萬', rate: '12%', active: est.taxBracketRate === 12 },
                            { bracket: '133 ~ 266 萬', rate: '20%', active: est.taxBracketRate === 20 },
                            { bracket: '266 ~ 498 萬', rate: '30%', active: est.taxBracketRate === 30 },
                            { bracket: '498 萬以上', rate: '40%', active: est.taxBracketRate === 40 },
                        ].map(b => (
                            <div key={b.rate} className={`flex justify-between items-center text-sm p-2 rounded ${b.active ? 'bg-primary/10 font-medium' : 'text-muted-foreground'}`}>
                                <span>{b.bracket}</span>
                                <Badge variant={b.active ? 'default' : 'outline'}>{b.rate}</Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">
                        💡 在 LINE 輸入「節稅建議」取得個人化的稅務優化方案
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

// ================================
// Advisor Tab
// ================================
function AdvisorTab() {
    const topics = [
        { id: 'comprehensive', icon: '📊', label: '綜合報告', desc: '投資+負債+稅務+退休全面分析', trigger: '理財建議' },
        { id: 'portfolio_review', icon: '📈', label: '投資組合', desc: '持倉分析、資產配置建議', trigger: '投資分析' },
        { id: 'debt_strategy', icon: '🏦', label: '負債策略', desc: '還款優先序、轉貸建議', trigger: '負債分析' },
        { id: 'tax_optimization', icon: '📋', label: '稅務優化', desc: '節稅方案、扣除項建議', trigger: '節稅建議' },
        { id: 'retirement_planning', icon: '🏖️', label: '退休規劃', desc: '退休金估算、儲蓄目標', trigger: '退休規劃' },
        { id: 'emergency_fund', icon: '🛡️', label: '緊急預備金', desc: '預備金評估、建立計畫', trigger: '緊急預備金' },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="pt-4">
                    <div className="text-center space-y-2">
                        <div className="text-4xl">🤖</div>
                        <h3 className="font-medium">AI 理財顧問</h3>
                        <p className="text-sm text-muted-foreground">
                            整合您的收支、投資、貸款、稅務資料，提供個人化的專業理財建議
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {topics.map(t => (
                    <Card key={t.id} className="hover:bg-muted/30 transition-colors cursor-default">
                        <CardContent className="pt-4">
                            <div className="flex gap-3">
                                <div className="text-2xl">{t.icon}</div>
                                <div className="flex-1">
                                    <h4 className="font-medium text-sm">{t.label}</h4>
                                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                                    <p className="text-xs text-primary mt-1">LINE 輸入「{t.trigger}」</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

// ================================
// Shared Components
// ================================
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <Card>
            <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
            </CardContent>
        </Card>
    );
}

function EmptyState({ icon, msg, hint }: { icon: string; msg: string; hint: string }) {
    return (
        <Card>
            <CardContent className="py-12 text-center">
                <div className="text-4xl mb-3">{icon}</div>
                <p className="text-muted-foreground mb-2">{msg}</p>
                <p className="text-xs text-muted-foreground/70">{hint}</p>
            </CardContent>
        </Card>
    );
}

// ================================
// SVG Donut Chart
// ================================
const CHART_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function DonutChart({ data, total }: { data: Record<string, number>; total: number }) {
    const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
    const r = 70, cx = 90, cy = 90, strokeWidth = 28;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    return (
        <div className="flex flex-col md:flex-row items-center gap-6">
            <svg viewBox="0 0 180 180" className="w-40 h-40 shrink-0">
                {entries.map(([cat, amt], i) => {
                    const pct = amt / total;
                    const dashArray = `${circumference * pct} ${circumference * (1 - pct)}`;
                    const dashOffset = -circumference * offset;
                    offset += pct;
                    return (
                        <circle
                            key={cat}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            strokeWidth={strokeWidth}
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            transform={`rotate(-90 ${cx} ${cy})`}
                        />
                    );
                })}
                <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-xs">總支出</text>
                <text x={cx} y={cy + 12} textAnchor="middle" className="fill-foreground text-sm font-bold">${total.toLocaleString()}</text>
            </svg>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {entries.map(([cat, amt], i) => (
                    <div key={cat} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{cat}</span>
                        <span className="font-mono ml-auto">{Math.round((amt / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

