'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Wallet,
    CreditCard,
    TrendingUp,
    TrendingDown,
    PieChart,
    Plus,
    ArrowLeft,
    Building2,
    Receipt,
    AlertCircle,
} from 'lucide-react';

// Mock finance data
const financeData = {
    accounts: [
        { id: 1, name: '玉山銀行', type: '活存', balance: 85000, icon: '🏦' },
        { id: 2, name: '中國信託', type: '活存', balance: 42800, icon: '🏛️' },
        { id: 3, name: '國泰世華', type: '定存', balance: 25000, icon: '🏢' },
    ],
    totalBalance: 152800,
    monthlyStats: {
        income: 65000,
        expense: 45200,
        savings: 19800,
    },
    expenses: [
        { category: '餐飲', amount: 12500, percentage: 27.7, color: 'bg-orange-500' },
        { category: '交通', amount: 8200, percentage: 18.1, color: 'bg-blue-500' },
        { category: '娛樂', amount: 6800, percentage: 15.0, color: 'bg-purple-500' },
        { category: '購物', amount: 9500, percentage: 21.0, color: 'bg-pink-500' },
        { category: '其他', amount: 8200, percentage: 18.1, color: 'bg-gray-500' },
    ],
    pendingBills: [
        { id: 1, name: '中信信用卡', amount: 15800, dueDate: '2026-02-10', status: 'pending' },
        { id: 2, name: '電費', amount: 1250, dueDate: '2026-02-15', status: 'pending' },
    ],
    recentTransactions: [
        { date: '2026-02-04', description: '全聯購物', amount: -580, category: '餐飲' },
        { date: '2026-02-03', description: '加油', amount: -1243, category: '交通' },
        { date: '2026-02-02', description: 'Netflix', amount: -390, category: '娛樂' },
        { date: '2026-02-01', description: '薪資', amount: 65000, category: '收入' },
    ],
};

export default function FinancePage() {
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
                        <p className="text-muted-foreground">帳戶餘額與支出分析</p>
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
                        <CardTitle className="text-sm font-medium text-muted-foreground">總資產</CardTitle>
                        <Wallet className="h-4 w-4 text-gold" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold">
                            ${financeData.totalBalance.toLocaleString()}
                        </div>
                        <span className="text-xs text-gold">3 個帳戶</span>
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
                            +${financeData.monthlyStats.income.toLocaleString()}
                        </div>
                        <span className="text-xs text-muted-foreground">儲蓄率 {((financeData.monthlyStats.savings / financeData.monthlyStats.income) * 100).toFixed(0)}%</span>
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
                            -${financeData.monthlyStats.expense.toLocaleString()}
                        </div>
                        <span className="text-xs text-muted-foreground">較上月 +5.2%</span>
                    </CardContent>
                </Card>
            </div>

            {/* Accounts */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-gold" />
                        銀行帳戶
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {financeData.accounts.map((account) => (
                            <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{account.icon}</span>
                                    <div>
                                        <p className="font-medium">{account.name}</p>
                                        <p className="text-sm text-muted-foreground">{account.type}</p>
                                    </div>
                                </div>
                                <p className="text-xl font-bold">${account.balance.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-purple-400" />
                        支出分析
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {financeData.expenses.map((expense, i) => (
                            <div key={i}>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm">{expense.category}</span>
                                    <span className="text-sm font-medium">${expense.amount.toLocaleString()} ({expense.percentage}%)</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${expense.color} rounded-full`}
                                        style={{ width: `${expense.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Pending Bills */}
            <Card className="border-gold/30 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-gold" />
                        待繳帳單
                        <Badge variant="outline" className="text-gold border-gold/30 ml-2">
                            {financeData.pendingBills.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {financeData.pendingBills.map((bill) => (
                            <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-gold/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gold/20">
                                        <CreditCard className="h-4 w-4 text-gold" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{bill.name}</p>
                                        <p className="text-sm text-muted-foreground">到期日: {bill.dueDate}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gold">${bill.amount.toLocaleString()}</p>
                                    <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        待繳
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-blue-400" />
                        近期交易
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {financeData.recentTransactions.map((tx, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${tx.amount > 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                        {tx.amount > 0 ? (
                                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                                        ) : (
                                            <TrendingDown className="h-4 w-4 text-red-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium">{tx.description}</p>
                                        <p className="text-sm text-muted-foreground">{tx.date} · {tx.category}</p>
                                    </div>
                                </div>
                                <p className={`font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
