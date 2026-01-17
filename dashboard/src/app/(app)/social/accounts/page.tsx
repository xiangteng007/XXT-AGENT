'use client';

import { useState } from 'react';
import { useTrackedAccounts, useSocialMutations } from '@/lib/hooks/useSocialData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton } from '@/components/shared';
import type { SocialPlatform, TrackedAccount } from '@/lib/social/types';
import {
    Users,
    Plus,
    Trash2,
    ExternalLink,
    CheckCircle,
    Star,
    TrendingUp,
    AlertCircle,
} from 'lucide-react';

const platformEmojis: Record<string, string> = {
    facebook: '📘',
    instagram: '📸',
    threads: '🧵',
    line: '💬',
    twitter: '🐦',
    tiktok: '🎵',
    youtube: '▶️',
};

const accountTypeLabels: Record<string, { label: string; color: string }> = {
    kol: { label: 'KOL', color: 'bg-purple-100 text-purple-700' },
    competitor: { label: '競品', color: 'bg-red-100 text-red-700' },
    partner: { label: '夥伴', color: 'bg-green-100 text-green-700' },
    media: { label: '媒體', color: 'bg-blue-100 text-blue-700' },
    influencer: { label: '網紅', color: 'bg-pink-100 text-pink-700' },
    other: { label: '其他', color: 'bg-gray-100 text-gray-700' },
};

export default function AccountsPage() {
    const { accounts, isLoading, refresh } = useTrackedAccounts();
    const { addAccount, deleteAccount, isSubmitting } = useSocialMutations();

    const [showAddForm, setShowAddForm] = useState(false);
    const [newAccount, setNewAccount] = useState({
        username: '',
        displayName: '',
        platform: 'instagram' as SocialPlatform,
        accountType: 'kol' as TrackedAccount['accountType'],
    });
    const [filterType, setFilterType] = useState<string>('all');
    const [filterPlatform, setFilterPlatform] = useState<string>('all');

    const handleAddAccount = async () => {
        if (!newAccount.username.trim()) return;

        await addAccount({
            platform: newAccount.platform,
            username: newAccount.username.trim(),
            displayName: newAccount.displayName.trim() || newAccount.username.trim(),
            accountType: newAccount.accountType,
            tags: [],
            priority: 'medium',
            followerCount: 0,
            followingCount: 0,
            postCount: 0,
            avgEngagement: 0,
            isActive: true,
        });

        setNewAccount({ username: '', displayName: '', platform: 'instagram', accountType: 'kol' });
        setShowAddForm(false);
        refresh();
    };

    const handleDelete = async (id: string) => {
        if (confirm('確定要刪除此追蹤帳號？')) {
            await deleteAccount(id);
            refresh();
        }
    };

    const filteredAccounts = accounts.filter(acc => {
        if (filterType !== 'all' && acc.accountType !== filterType) return false;
        if (filterPlatform !== 'all' && acc.platform !== filterPlatform) return false;
        return true;
    });

    const platforms = ['facebook', 'instagram', 'threads', 'twitter', 'tiktok', 'youtube', 'line'];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">帳號追蹤</h1>
                <LoadingSkeleton type="card" count={4} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        帳號追蹤
                    </h1>
                    <p className="text-muted-foreground">
                        追蹤 KOL、競品、媒體帳號（支援 Twitter/TikTok/YouTube）
                    </p>
                </div>
                <Button onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新增帳號
                </Button>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>新增追蹤帳號</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-5">
                            <select
                                value={newAccount.platform}
                                onChange={(e) => setNewAccount({ ...newAccount, platform: e.target.value as SocialPlatform })}
                                className="px-3 py-2 border rounded-md bg-background"
                                aria-label="平台"
                            >
                                {platforms.map(p => (
                                    <option key={p} value={p}>
                                        {platformEmojis[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </option>
                                ))}
                            </select>
                            <Input
                                value={newAccount.username}
                                onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                                placeholder="用戶名稱"
                            />
                            <Input
                                value={newAccount.displayName}
                                onChange={(e) => setNewAccount({ ...newAccount, displayName: e.target.value })}
                                placeholder="顯示名稱 (選填)"
                            />
                            <select
                                value={newAccount.accountType}
                                onChange={(e) => setNewAccount({ ...newAccount, accountType: e.target.value as TrackedAccount['accountType'] })}
                                className="px-3 py-2 border rounded-md bg-background"
                                aria-label="類型"
                            >
                                {Object.entries(accountTypeLabels).map(([type, { label }]) => (
                                    <option key={type} value={type}>{label}</option>
                                ))}
                            </select>
                            <Button onClick={handleAddAccount} disabled={isSubmitting || !newAccount.username.trim()}>
                                確認新增
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-3">
                <select
                    value={filterPlatform}
                    onChange={(e) => setFilterPlatform(e.target.value)}
                    className="px-3 py-2 border rounded-md bg-background text-sm"
                    aria-label="平台篩選"
                >
                    <option value="all">全部平台</option>
                    {platforms.map(p => (
                        <option key={p} value={p}>
                            {platformEmojis[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                        </option>
                    ))}
                </select>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 border rounded-md bg-background text-sm"
                    aria-label="類型篩選"
                >
                    <option value="all">全部類型</option>
                    {Object.entries(accountTypeLabels).map(([type, { label }]) => (
                        <option key={type} value={type}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{accounts.length}</div>
                        <div className="text-sm text-muted-foreground">總追蹤帳號</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold">
                            {accounts.filter(a => a.accountType === 'kol').length}
                        </div>
                        <div className="text-sm text-muted-foreground">KOL</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold">
                            {accounts.filter(a => a.accountType === 'competitor').length}
                        </div>
                        <div className="text-sm text-muted-foreground">競品帳號</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold">
                            {accounts.filter(a => a.isActive).length}
                        </div>
                        <div className="text-sm text-muted-foreground">活躍追蹤</div>
                    </CardContent>
                </Card>
            </div>

            {/* Account List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAccounts.length === 0 ? (
                    <Card className="md:col-span-2 lg:col-span-3">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            沒有符合條件的追蹤帳號
                        </CardContent>
                    </Card>
                ) : (
                    filteredAccounts.map((account) => (
                        <Card key={account.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="pt-4">
                                <div className="flex items-start gap-3">
                                    <div className="text-3xl">
                                        {platformEmojis[account.platform]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold truncate">
                                                {account.displayName}
                                            </span>
                                            {account.priority === 'high' && (
                                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                            )}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            @{account.username}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge className={accountTypeLabels[account.accountType].color}>
                                                {accountTypeLabels[account.accountType].label}
                                            </Badge>
                                            {account.isActive ? (
                                                <Badge variant="outline" className="text-green-600">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    活躍
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-gray-400">
                                                    <AlertCircle className="h-3 w-3 mr-1" />
                                                    暫停
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-muted-foreground">
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {account.followerCount.toLocaleString()}
                                                </div>
                                                <div>粉絲</div>
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {account.postCount}
                                                </div>
                                                <div>貼文</div>
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {account.avgEngagement.toLocaleString()}
                                                </div>
                                                <div>平均互動</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                                    <Button variant="ghost" size="sm">
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() => handleDelete(account.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
