"use strict";
/**
 * RBAC Permissions Configuration
 * Defines the permission matrix for all roles
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_DISPLAY_NAMES = exports.RESOURCE_DISPLAY_NAMES = exports.ROLE_DESCRIPTIONS = exports.ROLE_DISPLAY_NAMES = exports.ROLE_PERMISSIONS = void 0;
exports.hasPermission = hasPermission;
exports.getRolePermissions = getRolePermissions;
exports.getRolesWithPermission = getRolesWithPermission;
exports.getMinimumRole = getMinimumRole;
/**
 * Permission matrix defining which roles can perform which actions on resources
 *
 * Structure: ROLE_PERMISSIONS[role][resource] = allowed actions
 */
exports.ROLE_PERMISSIONS = {
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
exports.ROLE_DISPLAY_NAMES = {
    superadmin: '系統管理員',
    owner: '團隊擁有者',
    admin: '管理員',
    editor: '編輯者',
    viewer: '檢視者',
};
/**
 * Role descriptions
 */
exports.ROLE_DESCRIPTIONS = {
    superadmin: '擁有系統所有權限，可管理所有團隊',
    owner: '團隊擁有者，可管理團隊設定和成員',
    admin: '管理員，可管理專案和成員',
    editor: '編輯者，可建立和編輯內容',
    viewer: '檢視者，只能查看內容',
};
/**
 * Resource display names (Chinese)
 */
exports.RESOURCE_DISPLAY_NAMES = {
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
exports.ACTION_DISPLAY_NAMES = {
    create: '建立',
    read: '檢視',
    update: '編輯',
    delete: '刪除',
    manage: '管理',
};
/**
 * Check if a role has permission for a specific resource and action
 */
function hasPermission(role, resource, action) {
    const allowedActions = exports.ROLE_PERMISSIONS[role]?.[resource] ?? [];
    return allowedActions.includes(action);
}
/**
 * Get all permissions for a role
 */
function getRolePermissions(role) {
    const permissions = [];
    const rolePerms = exports.ROLE_PERMISSIONS[role];
    for (const [resource, actions] of Object.entries(rolePerms)) {
        for (const action of actions) {
            permissions.push({
                resource: resource,
                action: action,
            });
        }
    }
    return permissions;
}
/**
 * Get roles that can perform a specific action on a resource
 */
function getRolesWithPermission(resource, action) {
    const roles = [];
    for (const [role, perms] of Object.entries(exports.ROLE_PERMISSIONS)) {
        if (perms[resource]?.includes(action)) {
            roles.push(role);
        }
    }
    return roles;
}
/**
 * Get the minimum role required for a specific action on a resource
 */
function getMinimumRole(resource, action) {
    const roleOrder = ['viewer', 'editor', 'admin', 'owner', 'superadmin'];
    for (const role of roleOrder) {
        if (hasPermission(role, resource, action)) {
            return role;
        }
    }
    return null;
}
//# sourceMappingURL=permissions.config.js.map