/**
 * RBAC Permissions Configuration
 * Defines the permission matrix for all roles
 */

import { Role, Resource, Action, Permission } from '../types/rbac.types';

/**
 * Permission matrix defining which roles can perform which actions on resources
 * 
 * Structure: ROLE_PERMISSIONS[role][resource] = allowed actions
 */
export const ROLE_PERMISSIONS: Record<Role, Record<Resource, Action[]>> = {
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
 * Role display names (Chinese)
 */
export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
    superadmin: '系統管理員',
    owner: '團隊擁有者',
    admin: '管理員',
    editor: '編輯者',
    viewer: '檢視者',
};

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
    superadmin: '擁有系統所有權限，可管理所有團隊',
    owner: '團隊擁有者，可管理團隊設定和成員',
    admin: '管理員，可管理專案和成員',
    editor: '編輯者，可建立和編輯內容',
    viewer: '檢視者，只能查看內容',
};

/**
 * Resource display names (Chinese)
 */
export const RESOURCE_DISPLAY_NAMES: Record<Resource, string> = {
    system: '系統設定',
    team: '團隊管理',
    member: '成員管理',
    project: '專案',
    rule: '規則配置',
    notification: '通知設定',
    log: '操作日誌',
    dashboard: '儀表板',
    api: 'API 存取',
};

/**
 * Action display names (Chinese)
 */
export const ACTION_DISPLAY_NAMES: Record<Action, string> = {
    create: '建立',
    read: '檢視',
    update: '編輯',
    delete: '刪除',
    manage: '管理',
};

/**
 * Check if a role has permission for a specific resource and action
 */
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
    const allowedActions = ROLE_PERMISSIONS[role]?.[resource] ?? [];
    return allowedActions.includes(action);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
    const permissions: Permission[] = [];
    const rolePerms = ROLE_PERMISSIONS[role];
    
    for (const [resource, actions] of Object.entries(rolePerms)) {
        for (const action of actions) {
            permissions.push({
                resource: resource as Resource,
                action: action as Action,
            });
        }
    }
    
    return permissions;
}

/**
 * Get roles that can perform a specific action on a resource
 */
export function getRolesWithPermission(resource: Resource, action: Action): Role[] {
    const roles: Role[] = [];
    
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
        if (perms[resource]?.includes(action)) {
            roles.push(role as Role);
        }
    }
    
    return roles;
}

/**
 * Get the minimum role required for a specific action on a resource
 */
export function getMinimumRole(resource: Resource, action: Action): Role | null {
    const roleOrder: Role[] = ['viewer', 'editor', 'admin', 'owner', 'superadmin'];
    
    for (const role of roleOrder) {
        if (hasPermission(role, resource, action)) {
            return role;
        }
    }
    
    return null;
}
