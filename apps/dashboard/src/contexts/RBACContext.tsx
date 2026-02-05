'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * RBAC Types (mirror backend types)
 */
export type Role = 'superadmin' | 'owner' | 'admin' | 'editor' | 'viewer';
export type Resource = 'system' | 'team' | 'member' | 'project' | 'rule' | 'notification' | 'log' | 'dashboard' | 'api';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';

export interface Permission {
    resource: Resource;
    action: Action;
}

export interface TeamMembership {
    teamId: string;
    teamName: string;
    role: Role;
}

export interface RBACUser {
    userId: string;
    email: string;
    displayName: string;
    globalRole?: 'superadmin' | 'user';
    teamMemberships: TeamMembership[];
    currentTeamId?: string;
    currentRole?: Role;
}

/**
 * Role hierarchy for comparisons
 */
const ROLE_HIERARCHY: Record<Role, number> = {
    superadmin: 100,
    owner: 80,
    admin: 60,
    editor: 40,
    viewer: 20,
};

/**
 * Permission matrix (frontend mirror of backend)
 */
const ROLE_PERMISSIONS: Record<Role, Record<Resource, Action[]>> = {
    superadmin: {
        system: ['create', 'read', 'update', 'delete', 'manage'],
        team: ['create', 'read', 'update', 'delete', 'manage'],
        member: ['create', 'read', 'update', 'delete', 'manage'],
        project: ['create', 'read', 'update', 'delete', 'manage'],
        rule: ['create', 'read', 'update', 'delete', 'manage'],
        notification: ['create', 'read', 'update', 'delete', 'manage'],
        log: ['read', 'delete', 'manage'],
        dashboard: ['read', 'manage'],
        api: ['read', 'manage'],
    },
    owner: {
        system: [],
        team: ['read', 'update', 'delete', 'manage'],
        member: ['create', 'read', 'update', 'delete', 'manage'],
        project: ['create', 'read', 'update', 'delete', 'manage'],
        rule: ['create', 'read', 'update', 'delete', 'manage'],
        notification: ['create', 'read', 'update', 'delete', 'manage'],
        log: ['read', 'delete'],
        dashboard: ['read'],
        api: ['read'],
    },
    admin: {
        system: [],
        team: ['read', 'update'],
        member: ['create', 'read', 'update', 'delete'],
        project: ['create', 'read', 'update', 'delete'],
        rule: ['create', 'read', 'update', 'delete'],
        notification: ['create', 'read', 'update', 'delete'],
        log: ['read'],
        dashboard: ['read'],
        api: ['read'],
    },
    editor: {
        system: [],
        team: ['read'],
        member: ['read'],
        project: ['create', 'read', 'update'],
        rule: ['create', 'read', 'update'],
        notification: ['create', 'read', 'update'],
        log: ['read'],
        dashboard: ['read'],
        api: ['read'],
    },
    viewer: {
        system: [],
        team: ['read'],
        member: ['read'],
        project: ['read'],
        rule: ['read'],
        notification: ['read'],
        log: ['read'],
        dashboard: ['read'],
        api: ['read'],
    },
};

/**
 * RBAC Context interface
 */
interface RBACContextValue {
    user: RBACUser | null;
    isLoading: boolean;
    currentTeamId: string | null;
    currentRole: Role | null;
    
    // Actions
    setCurrentTeam: (teamId: string) => void;
    refreshUser: () => Promise<void>;
    
    // Permission checks
    hasPermission: (resource: Resource, action: Action) => boolean;
    hasRole: (minimumRole: Role) => boolean;
    isRoleHigherOrEqual: (role1: Role, role2: Role) => boolean;
    
    // Helpers
    can: {
        manageTeam: () => boolean;
        manageMembers: () => boolean;
        createProject: () => boolean;
        editProject: () => boolean;
        deleteProject: () => boolean;
        editRules: () => boolean;
        viewLogs: () => boolean;
    };
}

const RBACContext = createContext<RBACContextValue | null>(null);

/**
 * RBAC Provider component
 */
export function RBACProvider({ 
    children, 
    initialUser 
}: { 
    children: React.ReactNode;
    initialUser?: RBACUser | null;
}) {
    const [user, setUser] = useState<RBACUser | null>(initialUser || null);
    const [isLoading, setIsLoading] = useState(!initialUser);
    const [currentTeamId, setCurrentTeamId] = useState<string | null>(
        initialUser?.currentTeamId || null
    );

    // Derive current role from team membership
    const currentRole = React.useMemo(() => {
        if (!user) return null;
        if (user.globalRole === 'superadmin') return 'superadmin' as Role;
        if (!currentTeamId) return null;
        
        const membership = user.teamMemberships.find(m => m.teamId === currentTeamId);
        return membership?.role || null;
    }, [user, currentTeamId]);

    // Fetch user data
    const refreshUser = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });
            
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                
                // Auto-select first team if none selected
                if (!currentTeamId && data.user?.teamMemberships?.length > 0) {
                    setCurrentTeamId(data.user.teamMemberships[0].teamId);
                }
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentTeamId]);

    // Set current team
    const setCurrentTeam = useCallback((teamId: string) => {
        setCurrentTeamId(teamId);
        // Persist to localStorage
        localStorage.setItem('currentTeamId', teamId);
    }, []);

    // Permission check
    const hasPermission = useCallback((resource: Resource, action: Action): boolean => {
        if (!user) return false;
        if (user.globalRole === 'superadmin') return true;
        if (!currentRole) return false;
        
        const allowedActions = ROLE_PERMISSIONS[currentRole]?.[resource] ?? [];
        return allowedActions.includes(action);
    }, [user, currentRole]);

    // Role check
    const hasRole = useCallback((minimumRole: Role): boolean => {
        if (!user) return false;
        if (user.globalRole === 'superadmin') return true;
        if (!currentRole) return false;
        
        return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[minimumRole];
    }, [user, currentRole]);

    // Role comparison
    const isRoleHigherOrEqual = useCallback((role1: Role, role2: Role): boolean => {
        return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
    }, []);

    // Convenience permission checks
    const can = React.useMemo(() => ({
        manageTeam: () => hasPermission('team', 'manage'),
        manageMembers: () => hasPermission('member', 'manage'),
        createProject: () => hasPermission('project', 'create'),
        editProject: () => hasPermission('project', 'update'),
        deleteProject: () => hasPermission('project', 'delete'),
        editRules: () => hasPermission('rule', 'update'),
        viewLogs: () => hasPermission('log', 'read'),
    }), [hasPermission]);

    // Load saved team ID and user on mount
    useEffect(() => {
        const savedTeamId = localStorage.getItem('currentTeamId');
        if (savedTeamId && !currentTeamId) {
            setCurrentTeamId(savedTeamId);
        }
        
        if (!initialUser) {
            refreshUser();
        }
    }, [initialUser, refreshUser, currentTeamId]);

    const value: RBACContextValue = {
        user,
        isLoading,
        currentTeamId,
        currentRole,
        setCurrentTeam,
        refreshUser,
        hasPermission,
        hasRole,
        isRoleHigherOrEqual,
        can,
    };

    return (
        <RBACContext.Provider value={value}>
            {children}
        </RBACContext.Provider>
    );
}

/**
 * Hook to access RBAC context
 */
export function useRBAC(): RBACContextValue {
    const context = useContext(RBACContext);
    
    if (!context) {
        throw new Error('useRBAC must be used within an RBACProvider');
    }
    
    return context;
}

/**
 * Hook for permission checks
 */
export function usePermission(resource: Resource, action: Action): boolean {
    const { hasPermission } = useRBAC();
    return hasPermission(resource, action);
}

/**
 * Hook for role checks
 */
export function useRole(minimumRole: Role): boolean {
    const { hasRole } = useRBAC();
    return hasRole(minimumRole);
}

/**
 * Hook to get current user role
 */
export function useCurrentRole(): Role | null {
    const { currentRole } = useRBAC();
    return currentRole;
}

export default RBACContext;
