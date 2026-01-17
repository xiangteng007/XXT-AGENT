'use client';

import { useState } from 'react';
import { useMonitorKeywords, useSocialMutations } from '@/lib/hooks/useSocialData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { LoadingSkeleton } from '@/components/shared';
import type { Priority, SocialPlatform } from '@/lib/social/types';
import {
    Settings,
    Hash,
    Bell,
    Calendar,
    Plus,
    Trash2,
    Clock,
    Mail,
    Send,
    Save,
    RefreshCw,
} from 'lucide-react';

// Scheduled Report Types
interface ScheduledReport {
    id: string;
    name: string;
    schedule: 'daily' | 'weekly' | 'monthly';
    time: string;
    recipients: string[];
    sections: string[];
    enabled: boolean;
    lastSentAt?: string;
}

const defaultReports: ScheduledReport[] = [
    {
        id: 'daily_summary',
        name: '每日摘要報告',
        schedule: 'daily',
        time: '09:00',
        recipients: [],
        sections: ['overview', 'sentiment', 'top_posts'],
        enabled: false,
    },
    {
        id: 'weekly_analytics',
        name: '週報分析',
        schedule: 'weekly',
        time: '09:00',
        recipients: [],
        sections: ['overview', 'sentiment', 'trends', 'accounts', 'recommendations'],
        enabled: false,
    },
];

export default function SocialSettingsPage() {
    const { keywords, isLoading, refresh } = useMonitorKeywords();
    const { addKeyword, deleteKeyword, isSubmitting } = useSocialMutations();

    // Keywords
    const [newKeyword, setNewKeyword] = useState('');
    const [keywordPriority, setKeywordPriority] = useState<Priority>('medium');

    // Notifications
    const [telegramEnabled, setTelegramEnabled] = useState(true);
    const [lineEnabled, setLineEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [minSeverity, setMinSeverity] = useState(50);

    // Scheduled Reports
    const [reports, setReports] = useState<ScheduledReport[]>(defaultReports);
    const [newRecipient, setNewRecipient] = useState('');
    const [editingReport, setEditingReport] = useState<string | null>(null);

    const handleAddKeyword = async () => {
        if (!newKeyword.trim()) return;

        await addKeyword({
            keyword: newKeyword.trim(),
            isRegex: false,
            matchMode: 'contains',
            priority: keywordPriority,
            platforms: 'all',
            enabled: true,
        });

        setNewKeyword('');
        refresh();
    };

    const handleDeleteKeyword = async (id: string) => {
        if (confirm('確定要刪除此關鍵字？')) {
            await deleteKeyword(id);
            refresh();
        }
    };

    const toggleReport = (reportId: string) => {
        setReports(reports.map(r =>
            r.id === reportId ? { ...r, enabled: !r.enabled } : r
        ));
    };

    const updateReportRecipients = (reportId: string, recipients: string[]) => {
        setReports(reports.map(r =>
            r.id === reportId ? { ...r, recipients } : r
        ));
    };

    const addRecipientToReport = (reportId: string) => {
        if (!newRecipient.trim()) return;
        const report = reports.find(r => r.id === reportId);
        if (report && !report.recipients.includes(newRecipient.trim())) {
            updateReportRecipients(reportId, [...report.recipients, newRecipient.trim()]);
        }
        setNewRecipient('');
    };

    const priorityColors: Record<Priority, string> = {
        critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
        high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
        medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
        low: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">設定</h1>
                <LoadingSkeleton type="card" count={3} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="h-6 w-6" />
                    社群監控設定
                </h1>
                <p className="text-muted-foreground">
                    管理關鍵字、通知和排程報告
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Keywords */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Hash className="h-5 w-5" />
                            監控關鍵字
                        </CardTitle>
                        <CardDescription>
                            設定要監控的關鍵字，系統會自動追蹤相關貼文
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                placeholder="輸入關鍵字..."
                                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                            />
                            <select
                                value={keywordPriority}
                                onChange={(e) => setKeywordPriority(e.target.value as Priority)}
                                className="px-3 py-2 border rounded-md bg-background text-sm w-24"
                                aria-label="優先度"
                            >
                                <option value="critical">緊急</option>
                                <option value="high">高</option>
                                <option value="medium">中</option>
                                <option value="low">低</option>
                            </select>
                            <Button onClick={handleAddKeyword} disabled={isSubmitting || !newKeyword.trim()}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {keywords.map((kw) => (
                                <div key={kw.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                    <div className="flex items-center gap-2">
                                        <Badge className={priorityColors[kw.priority]}>
                                            {kw.priority}
                                        </Badge>
                                        <span className="text-sm font-medium">{kw.keyword}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                            {kw.hitCount} 次命中
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            onClick={() => handleDeleteKeyword(kw.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {keywords.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    尚未設定任何關鍵字
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            通知設定
                        </CardTitle>
                        <CardDescription>
                            設定警報通知的管道和條件
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Send className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm">Telegram 通知</span>
                                </div>
                                <Switch checked={telegramEnabled} onCheckedChange={setTelegramEnabled} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-500">💬</span>
                                    <span className="text-sm">LINE 通知</span>
                                </div>
                                <Switch checked={lineEnabled} onCheckedChange={setLineEnabled} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm">Email 通知</span>
                                </div>
                                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <label className="text-sm font-medium">最低嚴重度閾值</label>
                            <div className="flex items-center gap-4 mt-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={minSeverity}
                                    onChange={(e) => setMinSeverity(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-sm font-medium w-12">{minSeverity}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                只有嚴重度高於此值的事件才會觸發通知
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Scheduled Reports */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            排程報告
                        </CardTitle>
                        <CardDescription>
                            設定自動發送的定期報告
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            {reports.map((report) => (
                                <Card key={report.id} className={report.enabled ? 'border-primary' : ''}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base">{report.name}</CardTitle>
                                            <Switch
                                                checked={report.enabled}
                                                onCheckedChange={() => toggleReport(report.id)}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1">
                                                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                                <span>
                                                    {report.schedule === 'daily' ? '每日' :
                                                        report.schedule === 'weekly' ? '每週' : '每月'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span>{report.time}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1">
                                            {report.sections.map(s => (
                                                <Badge key={s} variant="secondary" className="text-xs">
                                                    {s === 'overview' ? '總覽' :
                                                        s === 'sentiment' ? '情緒' :
                                                            s === 'trends' ? '趨勢' :
                                                                s === 'top_posts' ? '熱門貼文' :
                                                                    s === 'accounts' ? '帳號' :
                                                                        s === 'recommendations' ? 'AI 建議' : s}
                                                </Badge>
                                            ))}
                                        </div>

                                        <div>
                                            <label className="text-xs text-muted-foreground">收件人</label>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {report.recipients.map(r => (
                                                    <Badge key={r} variant="outline" className="text-xs">
                                                        {r}
                                                        <button
                                                            className="ml-1 hover:text-destructive"
                                                            onClick={() => updateReportRecipients(
                                                                report.id,
                                                                report.recipients.filter(x => x !== r)
                                                            )}
                                                        >
                                                            ×
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                            {editingReport === report.id ? (
                                                <div className="flex gap-2 mt-2">
                                                    <Input
                                                        value={newRecipient}
                                                        onChange={(e) => setNewRecipient(e.target.value)}
                                                        placeholder="輸入 Email..."
                                                        className="text-sm h-8"
                                                        onKeyDown={(e) => e.key === 'Enter' && addRecipientToReport(report.id)}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => addRecipientToReport(report.id)}
                                                    >
                                                        新增
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-2 text-xs"
                                                    onClick={() => setEditingReport(report.id)}
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    新增收件人
                                                </Button>
                                            )}
                                        </div>

                                        {report.lastSentAt && (
                                            <p className="text-xs text-muted-foreground">
                                                上次發送: {new Date(report.lastSentAt).toLocaleString('zh-TW')}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button>
                    <Save className="h-4 w-4 mr-2" />
                    儲存設定
                </Button>
            </div>
        </div>
    );
}
