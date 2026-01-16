'use client';

import { useEffect, useState, useMemo } from 'react';
import { getSocialPosts, getKeywords, getExcludeWords, getNotifications } from '@/lib/api/client';
import type { SocialPost, Keyword, ExcludeWord, NotificationRule } from '@/lib/api/types';
import { DataTable, FilterBar, SeverityBadge, LoadingSkeleton, EmptyState } from '@/components/shared';
import type { Column } from '@/components/shared/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Facebook,
    Instagram,
    MessageCircle,
    Send,
    Download,
    Trash2,
    Plus,
    TrendingUp,
    BarChart3,
    Hash,
    Bell,
    X,
    AlertTriangle,
} from 'lucide-react';

export default function SocialMonitorPage() {
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [excludeWords, setExcludeWords] = useState<ExcludeWord[]>([]);
    const [notifications, setNotifications] = useState<NotificationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('posts');
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);

    // Filters
    const [searchKeyword, setSearchKeyword] = useState('');
    const [platformFilter, setPlatformFilter] = useState('all');
    const [timeRange, setTimeRange] = useState('24h');
    const [minEngagement, setMinEngagement] = useState('0');

    // New item inputs
    const [newKeyword, setNewKeyword] = useState('');
    const [newExcludeWord, setNewExcludeWord] = useState('');

    useEffect(() => {
        async function loadData() {
            try {
                const [postsData, keywordsData, excludeData, notifyData] = await Promise.all([
                    getSocialPosts(),
                    getKeywords(),
                    getExcludeWords(),
                    getNotifications(),
                ]);
                setPosts(postsData);
                setKeywords(keywordsData);
                setExcludeWords(excludeData);
                setNotifications(notifyData);
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'Facebook': return <Facebook className="h-4 w-4" />;
            case 'Instagram': return <Instagram className="h-4 w-4" />;
            case 'Threads': return <MessageCircle className="h-4 w-4" />;
            case 'LINE': return <Send className="h-4 w-4" />;
            default: return null;
        }
    };

    // Filtered posts
    const filteredPosts = useMemo(() => {
        let result = [...posts];

        if (searchKeyword) {
            const kw = searchKeyword.toLowerCase();
            result = result.filter(
                (p) => p.content.toLowerCase().includes(kw) || p.author.toLowerCase().includes(kw)
            );
        }

        if (platformFilter !== 'all') {
            result = result.filter((p) => p.platform === platformFilter);
        }

        const minEng = parseInt(minEngagement, 10);
        if (minEng > 0) {
            result = result.filter((p) => p.engagement >= minEng);
        }

        return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [posts, searchKeyword, platformFilter, minEngagement]);

    // Stats
    const stats = useMemo(() => {
        const platformCounts = posts.reduce((acc, p) => {
            acc[p.platform] = (acc[p.platform] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const totalEngagement = posts.reduce((acc, p) => acc + p.engagement, 0);
        return { platformCounts, totalEngagement, totalPosts: posts.length };
    }, [posts]);

    // Top keywords (simulated trends)
    const topKeywords = useMemo(() => {
        const kwCounts: Record<string, number> = {};
        posts.forEach((p) => {
            p.keywords?.forEach((kw) => {
                kwCounts[kw] = (kwCounts[kw] || 0) + 1;
            });
        });
        return Object.entries(kwCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }, [posts]);

    const formatTime = (ts: string) => {
        const date = new Date(ts);
        return date.toLocaleString('zh-TW', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        });
    };

    const postColumns: Column<SocialPost>[] = [
        {
            key: 'platform',
            header: '平台',
            className: 'w-[100px]',
            render: (post) => (
                <div className="flex items-center gap-2">
                    {getPlatformIcon(post.platform)}
                    <span className="text-xs">{post.platform}</span>
                </div>
            ),
        },
        {
            key: 'author',
            header: '作者',
            className: 'w-[150px]',
            render: (post) => (
                <div className="text-sm">
                    <p className="font-medium line-clamp-1">{post.author}</p>
                    <p className="text-xs text-muted-foreground">{post.authorHandle}</p>
                </div>
            ),
        },
        {
            key: 'content',
            header: '內容',
            render: (post) => <p className="text-sm line-clamp-2 max-w-md">{post.content}</p>,
        },
        {
            key: 'engagement',
            header: '互動',
            className: 'w-[80px]',
            render: (post) => <Badge variant="secondary">{post.engagement.toLocaleString()}</Badge>,
        },
        {
            key: 'severity',
            header: '嚴重度',
            className: 'w-[80px]',
            render: (post) => post.severity ? <SeverityBadge severity={post.severity} /> : <span className="text-muted-foreground">-</span>,
        },
        {
            key: 'timestamp',
            header: '時間',
            className: 'w-[100px]',
            render: (post) => <span className="text-xs text-muted-foreground">{formatTime(post.timestamp)}</span>,
        },
    ];

    const handleExportCSV = () => {
        const headers = ['platform', 'author', 'content', 'engagement', 'severity', 'timestamp'];
        const csv = [
            headers.join(','),
            ...filteredPosts.map((p) =>
                [p.platform, p.author, `"${p.content.replace(/"/g, '""')}"`, p.engagement, p.severity || '', p.timestamp].join(',')
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `social_posts_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const handleExportJSON = () => {
        const blob = new Blob([JSON.stringify(filteredPosts, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `social_posts_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const addKeyword = () => {
        if (!newKeyword.trim()) return;
        const kw: Keyword = {
            id: `kw_${Date.now()}`,
            keyword: newKeyword.trim(),
            priority: 'medium',
            createdAt: new Date().toISOString(),
        };
        setKeywords([...keywords, kw]);
        setNewKeyword('');
    };

    const removeKeyword = (id: string) => {
        setKeywords(keywords.filter((k) => k.id !== id));
    };

    const addExcludeWord = () => {
        if (!newExcludeWord.trim()) return;
        const word: ExcludeWord = {
            id: `ex_${Date.now()}`,
            word: newExcludeWord.trim(),
            createdAt: new Date().toISOString(),
        };
        setExcludeWords([...excludeWords, word]);
        setNewExcludeWord('');
    };

    const removeExcludeWord = (id: string) => {
        setExcludeWords(excludeWords.filter((w) => w.id !== id));
    };

    const clearAllFilters = () => {
        setSearchKeyword('');
        setPlatformFilter('all');
        setMinEngagement('0');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">社群監控</h1>
                    <p className="text-muted-foreground">Facebook、Instagram、Threads、LINE 貼文監控</p>
                </div>
                <LoadingSkeleton type="table" count={6} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">社群監控</h1>
                    <p className="text-muted-foreground">Facebook、Instagram、Threads、LINE 貼文監控</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportJSON}>
                        <Download className="h-4 w-4 mr-1" /> JSON
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setPurgeDialogOpen(true)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Purge
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="posts"><MessageCircle className="h-4 w-4 mr-1" />Posts</TabsTrigger>
                    <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 mr-1" />Trends</TabsTrigger>
                    <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1" />Stats</TabsTrigger>
                    <TabsTrigger value="keywords"><Hash className="h-4 w-4 mr-1" />Keywords</TabsTrigger>
                    <TabsTrigger value="exclude"><X className="h-4 w-4 mr-1" />Exclude Words</TabsTrigger>
                    <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-1" />Notifications</TabsTrigger>
                </TabsList>

                <TabsContent value="posts" className="space-y-4 mt-4">
                    <FilterBar
                        searchValue={searchKeyword}
                        onSearchChange={setSearchKeyword}
                        searchPlaceholder="搜尋內容或作者..."
                        filters={[
                            {
                                id: 'platform', label: '平台', value: platformFilter, onChange: setPlatformFilter,
                                options: [
                                    { value: 'all', label: '全部' },
                                    { value: 'Facebook', label: 'Facebook' },
                                    { value: 'Instagram', label: 'Instagram' },
                                    { value: 'Threads', label: 'Threads' },
                                    { value: 'LINE', label: 'LINE' },
                                ],
                            },
                            {
                                id: 'time', label: '時間', value: timeRange, onChange: setTimeRange,
                                options: [
                                    { value: '30m', label: '近30分鐘' },
                                    { value: '2h', label: '近2小時' },
                                    { value: '24h', label: '近24小時' },
                                    { value: '7d', label: '近7天' },
                                ],
                            },
                            {
                                id: 'engagement', label: '互動', value: minEngagement, onChange: setMinEngagement,
                                options: [
                                    { value: '0', label: '全部' },
                                    { value: '100', label: '≥ 100' },
                                    { value: '500', label: '≥ 500' },
                                    { value: '1000', label: '≥ 1000' },
                                ],
                            },
                        ]}
                        onClearAll={clearAllFilters}
                    />
                    <DataTable data={filteredPosts} columns={postColumns} />
                </TabsContent>

                <TabsContent value="trends" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>熱門關鍵字 Top 10</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {topKeywords.map(([kw, count], idx) => (
                                    <div key={kw} className="flex items-center gap-3">
                                        <span className="w-6 text-center text-muted-foreground font-bold">{idx + 1}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium">{kw}</span>
                                                <span className="text-sm text-muted-foreground">{count} 則</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${(count / topKeywords[0][1]) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stats" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">總貼文數</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{stats.totalPosts}</div></CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">總互動數</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{stats.totalEngagement.toLocaleString()}</div></CardContent>
                        </Card>
                        {Object.entries(stats.platformCounts).map(([platform, count]) => (
                            <Card key={platform}>
                                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                                    {getPlatformIcon(platform)}
                                    <CardTitle className="text-sm text-muted-foreground">{platform}</CardTitle>
                                </CardHeader>
                                <CardContent><div className="text-2xl font-bold">{count}</div></CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="keywords" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>監控關鍵字</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="新增關鍵字..." onKeyDown={(e) => e.key === 'Enter' && addKeyword()} />
                                <Button onClick={addKeyword}><Plus className="h-4 w-4" /></Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {keywords.map((kw) => (
                                    <Badge key={kw.id} variant="secondary" className="gap-1">
                                        {kw.keyword}
                                        <button onClick={() => removeKeyword(kw.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="exclude" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>排除詞彙</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input value={newExcludeWord} onChange={(e) => setNewExcludeWord(e.target.value)} placeholder="新增排除詞..." onKeyDown={(e) => e.key === 'Enter' && addExcludeWord()} />
                                <Button onClick={addExcludeWord}><Plus className="h-4 w-4" /></Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {excludeWords.map((w) => (
                                    <Badge key={w.id} variant="outline" className="gap-1 text-muted-foreground">
                                        {w.word}
                                        <button onClick={() => removeExcludeWord(w.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="mt-4">
                    <div className="space-y-4">
                        {notifications.map((rule) => (
                            <Card key={rule.id}>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-base">{rule.name}</CardTitle>
                                    <Switch checked={rule.enabled} />
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {rule.keywords.map((kw) => <Badge key={kw} variant="outline">{kw}</Badge>)}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>Min Severity: {rule.minSeverity}</span>
                                        <span>Channels: {rule.channels.filter((c) => c.enabled).map((c) => c.type).join(', ')}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Purge Confirmation Dialog */}
            <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            確認清除所有資料？
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        此操作將刪除所有社群貼文資料，無法復原。請確認您要繼續執行此操作。
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPurgeDialogOpen(false)}>取消</Button>
                        <Button variant="destructive" onClick={() => { setPosts([]); setPurgeDialogOpen(false); }}>確認清除</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
