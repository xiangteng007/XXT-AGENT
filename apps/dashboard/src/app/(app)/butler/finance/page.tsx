'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    PieChart,
    Plus,
    ArrowLeft,
    Receipt,
    Loader2,
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
    '餐飲': 'bg-orange-500',
    '交通': 'bg-blue-500',
    '娛樂': 'bg-purple-500',
    '購物': 'bg-pink-500',
    '日用品': 'bg-teal-500',
    '醫療': 'bg-red-500',
    '其他': 'bg-gray-500',
    '未分類': 'bg-gray-400',
};

interface FinanceData {
    totalExpense: number;
    totalIncome: number;
    netSavings: number;
    categories: Array<{ name: string; amount: number; percentage: number }>;
    recentTransactions: Array<{
        id: string;
        type: string;
        amount: number;
        category: string;
        description: string;
        date: string;
    }>;
    transactionCount: number;
}

export default function FinancePage() {
    const [data, setData] = useState<FinanceData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/butler/finance')
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
        );
    }

    const income = data?.totalIncome ?? 0;
    const expense = data?.totalExpense ?? 0;
    const savings = data?.netSavings ?? 0;
    const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(0) : '0';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/butler">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20">
                        <Wallet className="h-6 w-6 text-gold" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">財務管理</h1>
                        <p className="text-muted-foreground">本月收支分析</p>
                    </div>
                </div>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    記錄支出
                </Button>
            </div>

            {/* Overview Stats */}
            <div className="grid gap-4 md:grid-cols-3 animate-stagger">
                <Card className="bg-card border-gold/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">淨儲蓄</CardTitle>
                        <Wallet className="h-4 w-4 text-gold" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className={`text-4xl font-bold ${savings >= 0 ? 'text-gold' : 'text-red-400'}`}>
                            ${Math.abs(savings).toLocaleString()}
                        </div>
                        <span className="text-xs text-muted-foreground">儲蓄率 {savingsRate}%</span>
                    </CardContent>
                </Card>

                <Card className="bg-card border-emerald-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">本月收入</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-emerald-400">
                            +${income.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-red-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">本月支出</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-red-400">
                            -${expense.toLocaleString()}
                        </div>
                        <span className="text-xs text-muted-foreground">{data?.transactionCount ?? 0} 筆交易</span>
                    </CardContent>
                </Card>
            </div>

            {/* Expense Breakdown */}
            {(data?.categories?.length ?? 0) > 0 && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-purple-400" />
                            支出分析
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data!.categories.map((cat, i) => (
                                <div key={i}>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm">{cat.name}</span>
                                        <span className="text-sm font-medium">${cat.amount.toLocaleString()} ({cat.percentage}%)</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${CATEGORY_COLORS[cat.name] || 'bg-gray-500'} rounded-full transition-all`}
                                            style={{ width: `${cat.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recent Transactions */}
            {(data?.recentTransactions?.length ?? 0) > 0 && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-blue-400" />
                            近期交易
                            <Badge variant="outline" className="ml-2">{data!.recentTransactions.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data!.recentTransactions.map((tx) => {
                                const isIncome = tx.type === 'income';
                                return (
                                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isIncome ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                                {isIncome ? (
                                                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                                                ) : (
                                                    <TrendingDown className="h-4 w-4 text-red-400" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium">{tx.description || tx.category}</p>
                                                <p className="text-sm text-muted-foreground">{tx.date} · {tx.category}</p>
                                            </div>
                                        </div>
                                        <p className={`font-bold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isIncome ? '+' : '-'}${tx.amount.toLocaleString()}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!data?.transactionCount && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                        <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">尚無交易記錄</h3>
                        <p className="text-muted-foreground">透過 LINE 傳送「記帳 500 午餐」開始記錄</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
