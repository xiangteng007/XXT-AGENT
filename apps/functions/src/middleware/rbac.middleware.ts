/**
 * RBAC Middleware
 * Permission-based route protection
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { rbacService } from '../services/rbac.service';
import { Resource, Action, Role } from '../types/rbac.types';
import { ROLE_DISPLAY_NAMES } from '../config/permissions.config';

/**
 * Permission requirement options
 */
interface PermissionOptions {
    resource: Resource;
    action: Action;
    /** Custom error message */
    message?: string;
    /** Allow if user has any of these roles */
    allowRoles?: Role[];
}

/**
 * Create permission check middleware
 */
export function requirePermission(options: PermissionOptions) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const authReq = req as AuthenticatedRequest;

        // Check if user is authenticated
        if (!authReq.user) {
            res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: '請先登入',
            });
            return;
        }

        // Superadmin bypass
        if (authReq.user.globalRole === 'superadmin') {
            next();
            return;
        }

        // Check if specific roles are allowed
        if (options.allowRoles && options.allowRoles.length > 0) {
            const membership = authReq.teamId
                ? authReq.user.teamMemberships.find(m => m.teamId === authReq.teamId)
                : null;

            if (membership && options.allowRoles.includes(membership.role)) {
                next();
                return;
            }
        }

        // Check permission based on resource and action
        const result = await rbacService.authorize({
            user: authReq.user,
            teamId: authReq.teamId,
            resource: options.resource,
            action: options.action,
        });

        if (!result.allowed) {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: options.message || result.reason || '您沒有權限執行此操作',
                requiredRole: result.requiredRole,
                userRole: result.userRole,
            });
            return;
        }

        next();
    };
}

/**
 * Require minimum role for access
 */
export function requireRole(minimumRole: Role): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
        const authReq = req as AuthenticatedRequest;

        if (!authReq.user) {
            res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: '請先登入',
            });
            return;
        }

        // Superadmin bypass
        if (authReq.user.globalRole === 'superadmin') {
            next();
            return;
        }

        // Get user's role in the team
        if (!authReq.teamId) {
            res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: '缺少團隊 ID',
            });
            return;
        }

        const membership = authReq.user.teamMemberships.find(m => m.teamId === authReq.teamId);

        if (!membership) {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: '您不是此團隊的成員',
            });
            return;
        }

        if (!rbacService.isRoleHigherOrEqual(membership.role, minimumRole)) {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: `此操作需要「${ROLE_DISPLAY_NAMES[minimumRole]}」或更高權限`,
                requiredRole: minimumRole,
                userRole: membership.role,
            });
            return;
        }

        next();
    };
}

/**
 * Check if user owns a resource (creator check)
 */
export function requireOwnership(
    getResourceOwnerId: (req: Request) => Promise<string | null>
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const authReq = req as AuthenticatedRequest;

        if (!authReq.user) {
            res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: '請先登入',
            });
            return;
        }

        // Superadmin and owner bypass
        if (authReq.user.globalRole === 'superadmin') {
            next();
            return;
        }

        // Check if user is team owner/admin
        if (authReq.teamId) {
            const membership = authReq.user.teamMemberships.find(m => m.teamId === authReq.teamId);
            if (membership && ['owner', 'admin'].includes(membership.role)) {
                next();
                return;
            }
        }

        // Check resource ownership
        const ownerId = await getResourceOwnerId(req);

        if (ownerId === authReq.user.userId) {
            next();
            return;
        }

        res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: '您只能操作自己建立的資源',
        });
    };
}

/**
 * Convenience middleware factories
 */
export const permissions = {
    // System
    manageSystem: () => requirePermission({ resource: 'system', action: 'manage' }),
    
    // Team
    readTeam: () => requirePermission({ resource: 'team', action: 'read' }),
    updateTeam: () => requirePermission({ resource: 'team', action: 'update' }),
    deleteTeam: () => requirePermission({ resource: 'team', action: 'delete' }),
    manageTeam: () => requirePermission({ resource: 'team', action: 'manage' }),
    
    // Member
    readMembers: () => requirePermission({ resource: 'member', action: 'read' }),
    createMember: () => requirePermission({ resource: 'member', action: 'create' }),
    updateMember: () => requirePermission({ resource: 'member', action: 'update' }),
    deleteMember: () => requirePermission({ resource: 'member', action: 'delete' }),
    manageMembers: () => requirePermission({ resource: 'member', action: 'manage' }),
    
    // Project
    readProjects: () => requirePermission({ resource: 'project', action: 'read' }),
    createProject: () => requirePermission({ resource: 'project', action: 'create' }),
    updateProject: () => requirePermission({ resource: 'project', action: 'update' }),
    deleteProject: () => requirePermission({ resource: 'project', action: 'delete' }),
    
    // Rule
    readRules: () => requirePermission({ resource: 'rule', action: 'read' }),
    createRule: () => requirePermission({ resource: 'rule', action: 'create' }),
    updateRule: () => requirePermission({ resource: 'rule', action: 'update' }),
    deleteRule: () => requirePermission({ resource: 'rule', action: 'delete' }),
    
    // Notification
    readNotifications: () => requirePermission({ resource: 'notification', action: 'read' }),
    updateNotifications: () => requirePermission({ resource: 'notification', action: 'update' }),
    
    // Log
    readLogs: () => requirePermission({ resource: 'log', action: 'read' }),
    deleteLogs: () => requirePermission({ resource: 'log', action: 'delete' }),
};

/**
 * Role-based convenience middleware
 */
export const roles = {
    viewer: () => requireRole('viewer'),
    editor: () => requireRole('editor'),
    admin: () => requireRole('admin'),
    owner: () => requireRole('owner'),
};
