'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared';
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
    Loader2,
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
    const { getIdToken } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchReports = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/social/reports', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setReports((data.reports || []).map((r: Record<string, unknown>) => ({
                    id: r.id as string,
                    name: (r.name as string) || '',
                    type: (r.type as Report['type']) || 'daily',
                    status: (r.status as Report['status']) || 'completed',
                    generatedAt: (r.generatedAt as string) || '',
                    period: (r.period as Report['period']) || { start: '', end: '' },
                    metrics: (r.metrics as Report['metrics']) || { totalPosts: 0, avgSentiment: 0, topAccounts: 0, alerts: 0 },
                    downloadUrls: r.downloadUrls as Report['downloadUrls'],
                })));
            }
        } catch (err) {
            console.error('Failed to load reports:', err);
        }
        setIsLoading(false);
    }, [getIdToken]);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">排程報告</h1>
                <LoadingSkeleton type="card" count={4} />
            </div>
        );
    }

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
