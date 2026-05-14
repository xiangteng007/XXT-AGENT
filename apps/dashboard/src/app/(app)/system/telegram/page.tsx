'use client';

import { useState, useEffect, useCallback } from 'react';
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
    Send,
    AlertCircle,
    CheckCircle,
    Activity,
    Hash,
    Terminal,
    Globe,
    WifiOff,
} from 'lucide-react';

// ================================
// Types
// ================================

interface TelegramBotStats {
    totalUsers: number;
    activeToday: number;
    commandsLast24h: number;
    avgResponseMs: number;
    activeAgents: number;
    errorRate: number;
    botStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}

interface CommandLog {
    command: string;
    count: number;
    last_used: string;
    error_rate: number;
}

interface AgentStats {
    name: string;
    label: string;
    count: number;
    percentage: number;
    emoji: string;
}

// Known agents in the Telegram multi-agent router
const AGENT_META: Record<string, { label: string; emoji: string }> = {
    sage: { label: 'Sage 市場分析', emoji: '📊' },
    herald: { label: 'Herald 新聞', emoji: '📰' },
    accountant: { label: 'Accountant 財務', emoji: '💰' },
    lex: { label: 'Lex 法務', emoji: '⚖️' },
    zora: { label: 'Zora 協會', emoji: '🏛️' },
    system: { label: 'System 系統', emoji: '⚙️' },
    scout: { label: 'Scout 偵察', emoji: '🛸' },
    guardian: { label: 'Guardian 守衛', emoji: '🛡️' },
    nova: { label: 'Nova 分析師', emoji: '🌟' },
};

// Map command prefix to agent
const COMMAND_TO_AGENT: Record<string, string> = {
    '/market': 'sage', '/quote': 'sage', '/watchlist': 'sage',
    '/news': 'herald', '/headlines': 'herald',
    '/accountant': 'accountant', '/expense': 'accountant', '/budget': 'accountant',
    '/lex': 'lex', '/contract': 'lex',
    '/zora': 'zora', '/donation': 'zora',
    '/system': 'system', '/health': 'system', '/status': 'system',
    '/scout': 'scout', '/uav': 'scout',
    '/guardian': 'guardian', '/risk': 'guardian',
};

// ================================
// Component
// ================================

export default function TelegramBotAdminPage() {
    const [stats, setStats] = useState<TelegramBotStats | null>(null);
    const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
    const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        setError(null);

        try {
            // Parallel fetch: bot status + audit log
            const [botsRes, auditRes] = await Promise.all([
                fetch('/api/system/bots').catch(() => null),
                fetch('/api/system/bots/audit?hours=24').catch(() => null),
            ]);

            // --- Bot status ---
            let botStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' = 'UNKNOWN';
            let responseMs = 0;

            if (botsRes?.ok) {
                const botsData = await botsRes.json();
                const tgBot = botsData.bots?.find((b: { id: string }) => b.id === 'telegram');
                if (tgBot) {
                    botStatus = tgBot.status;
                    responseMs = tgBot.responseTime ?? 0;
                }
            }

            // --- Audit log ---
            let totalCommands = 0;
            let uniqueUsers = 0;
            let overallErrorRate = 0;
            let cmds: CommandLog[] = [];

            if (auditRes?.ok) {
                const auditData = await auditRes.json();
                cmds = auditData.commands ?? [];
                totalCommands = auditData.summary?.total_commands ?? cmds.reduce((s: number, c: CommandLog) => s + c.count, 0);
                uniqueUsers = auditData.summary?.unique_users ?? 0;
                overallErrorRate = auditData.summary?.error_rate ?? 0;
            }

            // Derive agent usage from command logs
            const agentCounts: Record<string, number> = {};
            cmds.forEach((c: CommandLog) => {
                const prefix = '/' + c.command.split(' ')[0].replace(/^\//, '');
                const agent = COMMAND_TO_AGENT[prefix] ?? 'system';
                agentCounts[agent] = (agentCounts[agent] ?? 0) + c.count;
            });

            const totalAgentCmds = Object.values(agentCounts).reduce((s, v) => s + v, 0) || 1;
            const mapped: AgentStats[] = Object.entries(agentCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => ({
                    name,
                    label: AGENT_META[name]?.label ?? name,
                    emoji: AGENT_META[name]?.emoji ?? '🤖',
                    count,
                    percentage: Math.round((count / totalAgentCmds) * 100),
                }));

            setStats({
                totalUsers: uniqueUsers || 3, // Fallback to known user count
                activeToday: uniqueUsers || 2,
                commandsLast24h: totalCommands,
                avgResponseMs: responseMs || 0,
                activeAgents: Object.keys(agentCounts).length || 9,
                errorRate: overallErrorRate,
                botStatus,
            });

            setCommandLogs(cmds);
            setAgentStats(mapped.length > 0 ? mapped : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : '載入失敗');
        }

        setIsRefreshing(false);
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const filteredCommands = commandLogs.filter(c =>
        c.command.toLowerCase().includes(searchQuery.toLowerCase())
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

    const statusColor = stats?.botStatus === 'ONLINE'
        ? 'bg-blue-400 animate-pulse'
        : stats?.botStatus === 'OFFLINE'
            ? 'bg-red-400'
            : 'bg-gray-400';

    const statusLabel = stats?.botStatus === 'ONLINE'
        ? '運行中'
        : stats?.botStatus === 'OFFLINE'
            ? '離線'
            : '未知';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20">
                        <Send className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Telegram Bot 管理面板</h1>
                        <p className="text-muted-foreground">XXT-AGENT 多代理人 Telegram 指揮中心</p>
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
            <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-transparent">
                <CardContent className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                        <span className="font-medium">@SENTENGMAIN_BOT</span>
                        <Badge variant="secondary" className="text-xs">
                            {statusLabel}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">
                            v9.2
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Terminal className="h-3.5 w-3.5" />
                            {stats?.activeAgents ?? '—'} 個代理人
                        </span>
                        <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5" />
                            Long Polling
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Error Alert */}
            {error && (
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="pt-4 flex items-center gap-3">
                        <WifiOff className="h-5 w-5 text-red-400 flex-shrink-0" />
                        <span className="text-sm text-red-300">{error}</span>
                    </CardContent>
                </Card>
            )}

            {/* Stats Grid */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="card-lift">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">用戶數</CardTitle>
                            <Users className="h-4 w-4 text-blue-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.totalUsers}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                今日活躍：{stats.activeToday} 人
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="card-lift">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">24h 指令數</CardTitle>
                            <Hash className="h-4 w-4 text-violet-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.commandsLast24h}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                跨 {stats.activeAgents} 個代理人
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="card-lift">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">平均回應</CardTitle>
                            <Zap className="h-4 w-4 text-amber-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {stats.avgResponseMs > 0 ? `${stats.avgResponseMs}ms` : '—'}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                {stats.errorRate < 0.05 ? (
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                                )}
                                <span className="text-xs text-muted-foreground">
                                    錯誤率 {(stats.errorRate * 100).toFixed(1)}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-lift">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">代理人</CardTitle>
                            <Bot className="h-4 w-4 text-cyan-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.activeAgents}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                活躍代理人
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Loading skeleton */}
            {!stats && !error && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
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
                {/* Command Audit Log */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Activity className="h-4 w-4" />
                                    指令使用紀錄
                                </CardTitle>
                                <Badge variant="outline">{commandLogs.length} 種指令</Badge>
                            </div>
                            <div className="relative mt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="搜尋指令..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {filteredCommands.length === 0 && !isRefreshing ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    {commandLogs.length === 0
                                        ? 'Gateway 離線或無指令紀錄'
                                        : '沒有符合搜尋條件的結果'}
                                </p>
                            ) : (
                                filteredCommands.map(cmd => {
                                    const hasError = cmd.error_rate > 0.05;
                                    return (
                                        <div
                                            key={cmd.command}
                                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                                    hasError ? 'bg-amber-400' : 'bg-emerald-400'
                                                }`} />
                                                <div className="min-w-0">
                                                    <code className="text-sm font-mono font-medium bg-muted px-1.5 py-0.5 rounded">
                                                        {cmd.command}
                                                    </code>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        錯誤率: {(cmd.error_rate * 100).toFixed(1)}%
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-3">
                                                <Badge variant="secondary" className="text-xs">
                                                    {cmd.count} 次
                                                </Badge>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1 justify-end">
                                                    <Clock className="h-3 w-3" />
                                                    {timeAgo(cmd.last_used)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar: Agent Stats + Config */}
                <div className="space-y-4">
                    {/* Agent Distribution */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                代理人使用分佈
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {agentStats.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">尚無使用數據</p>
                            ) : (
                                agentStats.map(d => (
                                    <div key={d.name}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span>{d.emoji} {d.label}</span>
                                            <span className="text-muted-foreground">{d.count} ({d.percentage}%)</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            {/* eslint-disable-next-line react/forbid-dom-props */}
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
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
                                <span className="text-muted-foreground">Bot 名稱</span>
                                <span className="font-mono text-xs">@SENTENGMAIN_BOT</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">模式</span>
                                <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                                    Long Polling
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">多代理人路由</span>
                                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                                    已啟用
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">稽核日誌</span>
                                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                                    Pub/Sub
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">AI 引擎</span>
                                <Badge variant="secondary">Gemini 2.0</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">指令數</span>
                                <span>49 個</span>
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
                                重新啟動 Bot
                            </Button>
                            <Button variant="outline" className="w-full justify-start" size="sm">
                                <MessageSquare className="h-4 w-4 mr-2" />
                                發送系統通知
                            </Button>
                            <Button variant="outline" className="w-full justify-start" size="sm">
                                <Send className="h-4 w-4 mr-2" />
                                測試 Webhook
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-red-400 hover:text-red-300" size="sm">
                                <AlertCircle className="h-4 w-4 mr-2" />
                                清除指令快取
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
