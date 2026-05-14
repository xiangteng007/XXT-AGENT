'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Bot,
    Settings,
    Users,
    MessageSquare,
    RefreshCw,
    Search,
    Clock,
    Zap,
    Shield,
    BarChart3,
    Smartphone,
    Globe,
    AlertCircle,
    CheckCircle,
    Activity,
} from 'lucide-react';

// ================================
// Types (mapped from /api/butler/admin/stats response)
// ================================

interface BotStats {
    totalUsers: number;
    activeToday: number;
    messagesLast24h: number;
    avgResponseMs: number;
    flexCardsServed: number;
    errorRate: number;
}

interface ConversationSession {
    userId: string;
    displayName: string;
    messageCount: number;
    lastActiveAt: string;
    domain: string;
    isExpired: boolean;
}

interface DomainStats {
    domain: string;
    label: string;
    count: number;
    percentage: number;
    emoji: string;
}

interface BotConfig {
    richMenu: boolean;
    flexMessage: boolean;
    multiTurn: boolean;
    model: string;
    sessionTTL: string;
    historySize: number;
}

const DOMAIN_LABELS: Record<string, { label: string; emoji: string }> = {
    general: { label: '一般對話', emoji: '💬' },
    finance: { label: '財務查詢', emoji: '💰' },
    schedule: { label: '行程安排', emoji: '📅' },
    health: { label: '健康記錄', emoji: '🏃' },
    vehicle: { label: '車輛管理', emoji: '🚗' },
};

// ================================
// Component
// ================================

export default function LineBotAdminPage() {
    const { getIdToken } = useAuth();
    const [stats, setStats] = useState<BotStats | null>(null);
    const [sessions, setSessions] = useState<ConversationSession[]>([]);
    const [domainStats, setDomainStats] = useState<DomainStats[]>([]);
    const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        setError(null);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/butler/admin/stats', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                throw new Error(`API 回應異常: HTTP ${res.status}`);
            }

            const data = await res.json();

            // Map API response → stats
            setStats({
                totalUsers: data.totalUsers ?? 0,
                activeToday: data.activeSessions ?? 0,
                messagesLast24h: data.messageVolume24h ?? 0,
                avgResponseMs: Math.round((data.avgResponseTime ?? 0) * 1000),
                flexCardsServed: 0, // Not tracked yet
                errorRate: 0, // Not tracked yet
            });

            // Map conversations → sessions
            const convs: ConversationSession[] = (data.conversations ?? []).map(
                (c: { userId: string; lastActivity: string; messageCount: number; domain: string; status: string }) => ({
                    userId: c.userId,
                    displayName: c.userId.substring(0, 8) + '…',
                    messageCount: c.messageCount,
                    lastActiveAt: c.lastActivity ?? new Date().toISOString(),
                    domain: c.domain,
                    isExpired: c.status === 'expired',
                })
            );
            setSessions(convs);

            // Map domainDistribution → domainStats
            const dist = data.domainDistribution ?? {};
            const totalDomainCount = Object.values(dist).reduce(
                (s: number, v) => s + (v as number), 0
            ) as number;
            const mapped: DomainStats[] = Object.entries(dist)
                .filter(([, v]) => (v as number) > 0)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([key, value]) => ({
                    domain: key,
                    label: DOMAIN_LABELS[key]?.label ?? key,
                    emoji: DOMAIN_LABELS[key]?.emoji ?? '📋',
                    count: value as number,
                    percentage: totalDomainCount > 0
                        ? Math.round(((value as number) / totalDomainCount) * 100)
                        : 0,
                }));
            setDomainStats(mapped);

            // Bot config
            if (data.botConfig) {
                setBotConfig(data.botConfig);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '載入失敗');
        }
        setIsRefreshing(false);
    }, [getIdToken]);

    useEffect(() => { refresh(); }, [refresh]);

    const filteredSessions = sessions.filter(s =>
        s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.userId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const timeAgo = (iso: string) => {
        if (!iso) return '—';
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins} 分鐘前`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} 小時前`;
        return `${Math.floor(hours / 24)} 天前`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20">
                        <Smartphone className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">LINE Bot 管理面板</h1>
                        <p className="text-muted-foreground">個人管家 LINE Bot 監控與管理</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={isRefreshing}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    刷新
                </Button>
            </div>

            {/* Bot Status Banner */}
            <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-transparent">
                <CardContent className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${error ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
                        <span className="font-medium">小秘書 LINE Bot</span>
                        <Badge variant="secondary" className="text-xs">
                            {error ? '連線異常' : '運行中'}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Smartphone className="h-3.5 w-3.5" />
                            LINE Messaging API
                        </span>
                        <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5" />
                            Webhook
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Error Alert */}
            {error && (
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="pt-4 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                        <span className="text-sm text-red-300">{error}</span>
                    </CardContent>
                </Card>
            )}

            {/* Stats Grid */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="card-lift">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">總用戶數</CardTitle>
                            <Users className="h-4 w-4 text-blue-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.totalUsers}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                活躍工作階段：{stats.activeToday} 個
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="card-lift">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">24h 訊息量</CardTitle>
                            <MessageSquare className="h-4 w-4 text-violet-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.messagesLast24h}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                過去 24 小時
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="card-lift">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">平均回應</CardTitle>
                            <Zap className="h-4 w-4 text-amber-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.avgResponseMs}ms</div>
                            <div className="flex items-center gap-1 mt-1">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-xs text-muted-foreground">
                                    Gemini 2.0 驅動
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Loading skeleton */}
            {!stats && !error && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="pt-6 animate-pulse">
                                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                                <div className="h-8 bg-muted rounded w-1/2 mb-2" />
                                <div className="h-3 bg-muted rounded w-2/3" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Active Sessions */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Activity className="h-4 w-4" />
                                    對話工作階段
                                </CardTitle>
                                <Badge variant="outline">{sessions.length} 個工作階段</Badge>
                            </div>
                            <div className="relative mt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="搜尋用戶或領域..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {filteredSessions.length === 0 && !isRefreshing ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    {sessions.length === 0 ? '尚無對話紀錄' : '沒有符合搜尋條件的結果'}
                                </p>
                            ) : (
                                filteredSessions.map(session => (
                                    <div
                                        key={session.userId + session.lastActiveAt}
                                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                                session.isExpired ? 'bg-gray-400' : 'bg-emerald-400 animate-pulse'
                                            }`} />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm font-mono">{session.displayName}</span>
                                                    <Badge
                                                        variant={session.isExpired ? 'secondary' : 'default'}
                                                        className="text-[10px] px-1.5 py-0"
                                                    >
                                                        {session.isExpired ? '已過期' : '活躍'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {DOMAIN_LABELS[session.domain]?.emoji ?? '📋'} {DOMAIN_LABELS[session.domain]?.label ?? session.domain}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-3">
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MessageSquare className="h-3 w-3" />
                                                {session.messageCount}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {timeAgo(session.lastActiveAt)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar: Domain Stats + Config */}
                <div className="space-y-4">
                    {/* Domain Distribution */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                領域分佈
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {domainStats.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">尚無數據</p>
                            ) : (
                                domainStats.map(d => (
                                    <div key={d.domain}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span>{d.emoji} {d.label}</span>
                                            <span className="text-muted-foreground">{d.count} ({d.percentage}%)</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            {/* eslint-disable-next-line react/forbid-dom-props */}
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                                                style={{ width: `${d.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Bot Config Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Bot 設定
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Rich Menu</span>
                                <Badge variant="outline" className={botConfig?.richMenu ? 'text-emerald-400 border-emerald-400/30' : ''}>
                                    {botConfig?.richMenu ? '已啟用' : '未啟用'}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Flex Message</span>
                                <Badge variant="outline" className={botConfig?.flexMessage ? 'text-emerald-400 border-emerald-400/30' : ''}>
                                    {botConfig?.flexMessage ? '已啟用' : '未啟用'}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">多輪對話</span>
                                <Badge variant="outline" className={botConfig?.multiTurn ? 'text-emerald-400 border-emerald-400/30' : ''}>
                                    {botConfig?.multiTurn ? '已啟用' : '未啟用'}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">AI 模型</span>
                                <Badge variant="secondary">{botConfig?.model ?? '—'}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Session TTL</span>
                                <span>{botConfig?.sessionTTL ?? '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">History 上限</span>
                                <span>{botConfig?.historySize ?? '—'} 條</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                快速操作
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start" size="sm">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                重新部署 Rich Menu
                            </Button>
                            <Button variant="outline" className="w-full justify-start" size="sm">
                                <MessageSquare className="h-4 w-4 mr-2" />
                                發送廣播訊息
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-red-400 hover:text-red-300" size="sm">
                                <AlertCircle className="h-4 w-4 mr-2" />
                                清除所有對話
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
