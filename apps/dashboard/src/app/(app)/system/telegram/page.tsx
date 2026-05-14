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
}

interface RecentCommand {
    id: string;
    user: string;
    command: string;
    agent: string;
    timestamp: string;
    status: 'success' | 'error' | 'pending';
    responseMs: number;
}

interface AgentStats {
    name: string;
    label: string;
    count: number;
    percentage: number;
    emoji: string;
}

// ================================
// Mock Data (replace with real Telegram Bot API calls)
// ================================

const mockStats: TelegramBotStats = {
    totalUsers: 3,
    activeToday: 2,
    commandsLast24h: 67,
    avgResponseMs: 1250,
    activeAgents: 9,
    errorRate: 0.015,
};

const mockCommands: RecentCommand[] = [
    {
        id: 'cmd_001',
        user: 'Xiang',
        command: '/market TSLA',
        agent: 'Sage',
        timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        status: 'success',
        responseMs: 980,
    },
    {
        id: 'cmd_002',
        user: 'Xiang',
        command: '/news 台灣半導體',
        agent: 'Herald',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        status: 'success',
        responseMs: 1450,
    },
    {
        id: 'cmd_003',
        user: 'Xiang',
        command: '/lex 合約審查',
        agent: 'Lex',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: 'success',
        responseMs: 2100,
    },
    {
        id: 'cmd_004',
        user: 'Admin',
        command: '/system',
        agent: 'System',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        status: 'success',
        responseMs: 850,
    },
    {
        id: 'cmd_005',
        user: 'Xiang',
        command: '/accountant 月報',
        agent: 'Accountant',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'error',
        responseMs: 5000,
    },
];

const mockAgentStats: AgentStats[] = [
    { name: 'sage', label: 'Sage 市場分析', count: 28, percentage: 42, emoji: '📊' },
    { name: 'herald', label: 'Herald 新聞', count: 15, percentage: 22, emoji: '📰' },
    { name: 'accountant', label: 'Accountant 財務', count: 10, percentage: 15, emoji: '💰' },
    { name: 'lex', label: 'Lex 法務', count: 8, percentage: 12, emoji: '⚖️' },
    { name: 'zora', label: 'Zora 協會', count: 4, percentage: 6, emoji: '🏛️' },
    { name: 'system', label: 'System 系統', count: 2, percentage: 3, emoji: '⚙️' },
];

// ================================
// Component
// ================================

export default function TelegramBotAdminPage() {
    const [stats, setStats] = useState<TelegramBotStats>(mockStats);
    const [commands, setCommands] = useState<RecentCommand[]>(mockCommands);
    const [agentStats] = useState<AgentStats[]>(mockAgentStats);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        // TODO: Replace with real API call to telegram-bot service
        await new Promise(r => setTimeout(r, 500));
        setStats(mockStats);
        setCommands(mockCommands);
        setIsRefreshing(false);
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const filteredCommands = commands.filter(c =>
        c.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.agent.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const timeAgo = (iso: string) => {
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
                        <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
                        <span className="font-medium">@SENTENGMAIN_BOT</span>
                        <Badge variant="secondary" className="text-xs">運行中</Badge>
                        <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">
                            v9.2
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Terminal className="h-3.5 w-3.5" />
                            {stats.activeAgents} 個代理人
                        </span>
                        <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5" />
                            Long Polling
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid */}
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
                        <div className="text-3xl font-bold">{stats.avgResponseMs}ms</div>
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

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Recent Commands */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Activity className="h-4 w-4" />
                                    最近指令
                                </CardTitle>
                                <Badge variant="outline">{commands.length} 筆紀錄</Badge>
                            </div>
                            <div className="relative mt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="搜尋用戶、指令或代理人..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {filteredCommands.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    沒有找到指令紀錄
                                </p>
                            ) : (
                                filteredCommands.map(cmd => (
                                    <div
                                        key={cmd.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                                cmd.status === 'success' ? 'bg-emerald-400' :
                                                cmd.status === 'error' ? 'bg-red-400' :
                                                'bg-amber-400 animate-pulse'
                                            }`} />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">{cmd.user}</span>
                                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                                        {cmd.command}
                                                    </code>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    代理人: {cmd.agent} • {cmd.responseMs}ms
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-3">
                                            <Badge
                                                variant={cmd.status === 'success' ? 'secondary' : cmd.status === 'error' ? 'destructive' : 'outline'}
                                                className="text-[10px] px-1.5 py-0"
                                            >
                                                {cmd.status === 'success' ? '成功' : cmd.status === 'error' ? '失敗' : '處理中'}
                                            </Badge>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1 justify-end">
                                                <Clock className="h-3 w-3" />
                                                {timeAgo(cmd.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                ))
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
                            {agentStats.map(d => (
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
                            ))}
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
