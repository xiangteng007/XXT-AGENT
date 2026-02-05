/**
 * RBAC Middleware
 * Permission-based route protection
 */
import { Request, Response, NextFunction } from 'express';
import { Resource, Action, Role } from '../types/rbac.types';
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
export declare function requirePermission(options: PermissionOptions): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Require minimum role for access
 */
export declare function requireRole(minimumRole: Role): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Check if user owns a resource (creator check)
 */
export declare function requireOwnership(getResourceOwnerId: (req: Request) => Promise<string | null>): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Convenience middleware factories
 */
export declare const permissions: {
    manageSystem: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    readTeam: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateTeam: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteTeam: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    manageTeam: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    readMembers: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createMember: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateMember: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteMember: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    manageMembers: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    readProjects: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createProject: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateProject: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteProject: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    readRules: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createRule: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateRule: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteRule: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    readNotifications: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateNotifications: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    readLogs: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteLogs: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
/**
 * Role-based convenience middleware
 */
export declare const roles: {
    viewer: () => (req: Request, res: Response, next: NextFunction) => void;
    editor: () => (req: Request, res: Response, next: NextFunction) => void;
    admin: () => (req: Request, res: Response, next: NextFunction) => void;
    owner: () => (req: Request, res: Response, next: NextFunction) => void;
};
export {};
//# sourceMappingURL=rbac.middleware.d.ts.map