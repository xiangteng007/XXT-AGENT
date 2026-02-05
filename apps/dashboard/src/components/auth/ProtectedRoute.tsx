'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useRBAC, Role, Resource, Action } from '@/contexts/RBACContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    /** Required permission */
    permission?: { resource: Resource; action: Action };
    /** Required minimum role */
    minimumRole?: Role;
    /** Fallback component if unauthorized */
    fallback?: React.ReactNode;
    /** Redirect path if unauthorized */
    redirectTo?: string;
}

/**
 * Protected route wrapper component
 * Checks permissions/roles before rendering children
 */
export function ProtectedRoute({
    children,
    permission,
    minimumRole,
    fallback,
    redirectTo = '/unauthorized',
}: ProtectedRouteProps) {
    const router = useRouter();
    const { user, isLoading, hasPermission, hasRole } = useRBAC();

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
            </div>
        );
    }

    // Check if user is authenticated
    if (!user) {
        router.push('/login');
        return null;
    }

    // Check permission
    if (permission && !hasPermission(permission.resource, permission.action)) {
        if (fallback) {
            return <>{fallback}</>;
        }
        router.push(redirectTo);
        return null;
    }

    // Check role
    if (minimumRole && !hasRole(minimumRole)) {
        if (fallback) {
            return <>{fallback}</>;
        }
        router.push(redirectTo);
        return null;
    }

    return <>{children}</>;
}

/**
 * Component that only renders children if user has permission
 */
interface CanShowProps {
    children: React.ReactNode;
    permission?: { resource: Resource; action: Action };
    minimumRole?: Role;
    fallback?: React.ReactNode;
}

export function CanShow({ 
    children, 
    permission, 
    minimumRole, 
    fallback = null 
}: CanShowProps) {
    const { hasPermission, hasRole, isLoading, user } = useRBAC();

    if (isLoading || !user) return null;

    if (permission && !hasPermission(permission.resource, permission.action)) {
        return <>{fallback}</>;
    }

    if (minimumRole && !hasRole(minimumRole)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * Button that is disabled if user lacks permission
 */
interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    permission?: { resource: Resource; action: Action };
    minimumRole?: Role;
    disabledTooltip?: string;
}

export function PermissionButton({
    permission,
    minimumRole,
    disabledTooltip = '您沒有權限執行此操作',
    children,
    disabled,
    ...props
}: PermissionButtonProps) {
    const { hasPermission, hasRole, isLoading, user } = useRBAC();

    const isUnauthorized = React.useMemo(() => {
        if (isLoading || !user) return true;
        if (permission && !hasPermission(permission.resource, permission.action)) return true;
        if (minimumRole && !hasRole(minimumRole)) return true;
        return false;
    }, [isLoading, user, permission, minimumRole, hasPermission, hasRole]);

    const isDisabled = disabled || isUnauthorized;

    return (
        <button
            {...props}
            disabled={isDisabled}
            title={isUnauthorized ? disabledTooltip : props.title}
            className={`${props.className || ''} ${isUnauthorized ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {children}
        </button>
    );
}

/**
 * Role badge component
 */
const ROLE_COLORS: Record<Role, string> = {
    superadmin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    owner: 'bg-gold/20 text-gold border-gold/30',
    admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    editor: 'bg-green-500/20 text-green-400 border-green-500/30',
    viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const ROLE_LABELS: Record<Role, string> = {
    superadmin: '系統管理員',
    owner: '擁有者',
    admin: '管理員',
    editor: '編輯者',
    viewer: '檢視者',
};

interface RoleBadgeProps {
    role: Role;
    size?: 'sm' | 'md' | 'lg';
}

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-1',
        lg: 'text-base px-3 py-1.5',
    };

    return (
        <span 
            className={`
                inline-flex items-center font-medium rounded-lg border
                ${ROLE_COLORS[role]} 
                ${sizeClasses[size]}
            `}
        >
            {ROLE_LABELS[role]}
        </span>
    );
}
