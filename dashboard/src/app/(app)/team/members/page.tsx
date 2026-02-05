'use client';

import { useState, useEffect } from 'react';
import { useRBAC, Role } from '@/contexts/RBACContext';
import { CanShow, RoleBadge } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Users,
    UserPlus,
    MoreHorizontal,
    Mail,
    Calendar,
    Shield,
    Trash2,
    Edit2,
    Crown,
} from 'lucide-react';

interface TeamMember {
    userId: string;
    email: string;
    displayName: string;
    role: Role;
    joinedAt: string;
}

export default function TeamMembersPage() {
    const { user, currentTeamId, can } = useRBAC();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);

    useEffect(() => {
        if (currentTeamId) {
            loadMembers();
        }
    }, [currentTeamId]);

    async function loadMembers() {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/teams/${currentTeamId}/members`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setMembers(data.members);
            }
        } catch (error) {
            console.error('Failed to load members:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function updateRole(userId: string, newRole: Role) {
        try {
            await fetch(`/api/teams/${currentTeamId}/members/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
                credentials: 'include',
            });
            await loadMembers();
        } catch (error) {
            console.error('Failed to update role:', error);
        }
    }

    async function removeMember(userId: string) {
        if (!confirm('確定要移除此成員？')) return;
        
        try {
            await fetch(`/api/teams/${currentTeamId}/members/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            await loadMembers();
        } catch (error) {
            console.error('Failed to remove member:', error);
        }
    }

    const roleOrder: Role[] = ['owner', 'admin', 'editor', 'viewer'];
    const sortedMembers = [...members].sort((a, b) => {
        return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 bg-muted/50 rounded animate-pulse" />
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gold/10 border border-gold/20">
                        <Users className="h-6 w-6 text-gold" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">團隊成員</h1>
                        <p className="text-muted-foreground text-sm">
                            {members.length} 位成員
                        </p>
                    </div>
                </div>
                
                <CanShow minimumRole="admin">
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gold text-black rounded-xl font-medium hover:bg-gold/90 transition-colors"
                    >
                        <UserPlus className="h-4 w-4" />
                        邀請成員
                    </button>
                </CanShow>
            </div>

            {/* Members List */}
            <Card className="border-border/50 bg-card/50">
                <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                        {sortedMembers.map((member) => (
                            <div
                                key={member.userId}
                                className="flex items-center justify-between p-4 hover:bg-gold/[0.02] transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    {/* Avatar */}
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 flex items-center justify-center">
                                        <span className="text-lg font-semibold text-gold">
                                            {member.displayName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    
                                    {/* Info */}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {member.displayName}
                                            </span>
                                            {member.role === 'owner' && (
                                                <Crown className="h-4 w-4 text-gold" />
                                            )}
                                            {member.userId === user?.userId && (
                                                <Badge variant="outline" className="text-xs">
                                                    你
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Mail className="h-3 w-3" />
                                                {member.email}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(member.joinedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <RoleBadge role={member.role} />
                                    
                                    <CanShow minimumRole="admin">
                                        {member.userId !== user?.userId && member.role !== 'owner' && (
                                            <div className="flex items-center gap-1">
                                                {/* Role selector dropdown would go here */}
                                                <button
                                                    onClick={() => {
                                                        const newRole = prompt(
                                                            '輸入新角色 (admin/editor/viewer):',
                                                            member.role
                                                        ) as Role;
                                                        if (newRole && ['admin', 'editor', 'viewer'].includes(newRole)) {
                                                            updateRole(member.userId, newRole);
                                                        }
                                                    }}
                                                    className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                                    title="變更角色"
                                                >
                                                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                                                </button>
                                                <button
                                                    onClick={() => removeMember(member.userId)}
                                                    className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                                    title="移除成員"
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </button>
                                            </div>
                                        )}
                                    </CanShow>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Role Legend */}
            <Card className="border-border/50 bg-card/50">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-gold" />
                        角色權限說明
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <RoleBadge role="owner" size="sm" />
                            <p className="text-xs text-muted-foreground">完整團隊控制權</p>
                        </div>
                        <div className="space-y-1">
                            <RoleBadge role="admin" size="sm" />
                            <p className="text-xs text-muted-foreground">管理成員與專案</p>
                        </div>
                        <div className="space-y-1">
                            <RoleBadge role="editor" size="sm" />
                            <p className="text-xs text-muted-foreground">建立與編輯內容</p>
                        </div>
                        <div className="space-y-1">
                            <RoleBadge role="viewer" size="sm" />
                            <p className="text-xs text-muted-foreground">只能查看內容</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
