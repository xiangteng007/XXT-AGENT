'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    FileText,
    Download,
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    RefreshCw,
    Eye,
    Share2,
} from 'lucide-react';

interface Report {
    id: string;
    name: string;
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    status: 'completed' | 'processing' | 'failed';
    generatedAt: string;
    period: { start: string; end: string };
    metrics: {
        totalPosts: number;
        avgSentiment: number;
        topAccounts: number;
        alerts: number;
    };
    downloadUrls?: { pdf?: string; excel?: string };
}

// Mock data
const mockReports: Report[] = [
    {
        id: '1', name: '每日社群監控報告', type: 'daily', status: 'completed',
        generatedAt: new Date().toISOString(),
        period: { start: '2026-01-16', end: '2026-01-16' },
        metrics: { totalPosts: 1250, avgSentiment: 0.65, topAccounts: 15, alerts: 3 },
        downloadUrls: { pdf: '#', excel: '#' },
    },
    {
        id: '2', name: '每週社群趨勢報告', type: 'weekly', status: 'completed',
        generatedAt: new Date(Date.now() - 86400000).toISOString(),
        period: { start: '2026-01-10', end: '2026-01-16' },
        metrics: { totalPosts: 8750, avgSentiment: 0.58, topAccounts: 42, alerts: 12 },
        downloadUrls: { pdf: '#', excel: '#' },
    },
    {
        id: '3', name: '每月綜合分析報告', type: 'monthly', status: 'processing',
        generatedAt: new Date(Date.now() - 172800000).toISOString(),
        period: { start: '2025-12-01', end: '2025-12-31' },
        metrics: { totalPosts: 35200, avgSentiment: 0.62, topAccounts: 128, alerts: 45 },
    },
    {
        id: '4', name: '自訂期間報告', type: 'custom', status: 'failed',
        generatedAt: new Date(Date.now() - 259200000).toISOString(),
        period: { start: '2026-01-01', end: '2026-01-15' },
        metrics: { totalPosts: 0, avgSentiment: 0, topAccounts: 0, alerts: 0 },
    },
];

const typeLabels: Record<string, { label: string; color: string }> = {
    daily: { label: '每日', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    weekly: { label: '每週', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    monthly: { label: '每月', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    custom: { label: '自訂', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
};

const statusIcons: Record<string, { icon: React.ReactNode; color: string }> = {
    completed: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-500' },
    processing: { icon: <RefreshCw className="h-4 w-4 animate-spin" />, color: 'text-blue-500' },
    failed: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-500' },
};

export default function SocialReportsPage() {
    const [reports] = useState<Report[]>(mockReports);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('zh-TW', {
            year: 'numeric', month: '2-digit', day: '2-digit',
        });
    };

    const formatTime = (isoStr: string) => {
        const date = new Date(isoStr);
        return date.toLocaleString('zh-TW', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        });
    };

    const getSentimentLabel = (score: number) => {
        if (score >= 0.7) return { label: '正面', color: 'text-green-500' };
        if (score >= 0.4) return { label: '中性', color: 'text-gray-500' };
        return { label: '負面', color: 'text-red-500' };
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6" />
                        排程報告
                    </h1>
                    <p className="text-muted-foreground">
                        檢視與下載歷史監控報告
                    </p>
                </div>
                <Button>
                    <Calendar className="h-4 w-4 mr-2" />
                    產生新報告
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{reports.length}</div>
                        <div className="text-sm text-muted-foreground">總報告數</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-green-600">
                            {reports.filter(r => r.status === 'completed').length}
                        </div>
                        <div className="text-sm text-muted-foreground">已完成</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-blue-600">
                            {reports.filter(r => r.status === 'processing').length}
                        </div>
                        <div className="text-sm text-muted-foreground">處理中</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-red-600">
                            {reports.filter(r => r.status === 'failed').length}
                        </div>
                        <div className="text-sm text-muted-foreground">失敗</div>
                    </CardContent>
                </Card>
            </div>

            {/* Reports List */}
            <div className="space-y-4">
                {reports.map(report => {
                    const sentiment = getSentimentLabel(report.metrics.avgSentiment);
                    const status = statusIcons[report.status];

                    return (
                        <Card key={report.id}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold">{report.name}</h3>
                                            <Badge className={typeLabels[report.type].color}>
                                                {typeLabels[report.type].label}
                                            </Badge>
                                            <span className={`flex items-center gap-1 ${status.color}`}>
                                                {status.icon}
                                                <span className="text-sm">
                                                    {report.status === 'completed' ? '已完成' :
                                                        report.status === 'processing' ? '處理中' : '失敗'}
                                                </span>
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatDate(report.period.start)} ~ {formatDate(report.period.end)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                產生於 {formatTime(report.generatedAt)}
                                            </span>
                                        </div>

                                        {report.status === 'completed' && (
                                            <div className="grid gap-4 md:grid-cols-4 text-sm">
                                                <div>
                                                    <div className="text-muted-foreground">總貼文</div>
                                                    <div className="font-medium">{report.metrics.totalPosts.toLocaleString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">平均情緒</div>
                                                    <div className={`font-medium ${sentiment.color}`}>
                                                        {sentiment.label} ({(report.metrics.avgSentiment * 100).toFixed(0)}%)
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">追蹤帳號</div>
                                                    <div className="font-medium">{report.metrics.topAccounts}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">觸發警報</div>
                                                    <div className="font-medium">{report.metrics.alerts}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        {report.status === 'completed' && (
                                            <>
                                                <Button variant="outline" size="sm">
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    檢視
                                                </Button>
                                                <Button variant="outline" size="sm">
                                                    <Download className="h-4 w-4 mr-1" />
                                                    PDF
                                                </Button>
                                                <Button variant="outline" size="sm">
                                                    <Share2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                        {report.status === 'failed' && (
                                            <Button variant="outline" size="sm">
                                                <RefreshCw className="h-4 w-4 mr-1" />
                                                重試
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
