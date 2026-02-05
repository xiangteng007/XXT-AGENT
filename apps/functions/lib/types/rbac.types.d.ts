/**
 * RBAC Types - Role-Based Access Control
 * XXT-AGENT Platform
 */
/**
 * System roles in hierarchical order (highest to lowest)
 */
export type Role = 'superadmin' | 'owner' | 'admin' | 'editor' | 'viewer';
/**
 * Role hierarchy levels for comparison
 */
export declare const ROLE_HIERARCHY: Record<Role, number>;
/**
 * Resources that can be protected
 */
export type Resource = 'system' | 'team' | 'member' | 'project' | 'rule' | 'notification' | 'log' | 'dashboard' | 'api';
/**
 * Actions that can be performed on resources
 */
export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';
/**
 * Permission definition
 */
export interface Permission {
    resource: Resource;
    action: Action;
}
/**
 * User context for request authorization
 */
export interface UserContext {
    userId: string;
    email: string;
    displayName: string;
    globalRole?: 'superadmin' | 'user';
    teamMemberships: TeamMembership[];
}
/**
 * Team membership with role
 */
export interface TeamMembership {
    teamId: string;
    teamName: string;
    role: Role;
    permissions: Permission[];
    joinedAt: Date;
}
/**
 * Authorization result
 */
export interface AuthResult {
    allowed: boolean;
    reason?: string;
    requiredRole?: Role;
    userRole?: Role;
}
/**
 * Request context for RBAC checks
 */
export interface RBACContext {
    user: UserContext;
    teamId?: string;
    resource: Resource;
    action: Action;
}
/**
 * Team member document for Firestore
 */
export interface TeamMemberDocument {
    userId: string;
    email: string;
    displayName: string;
    role: Role;
    customPermissions?: Permission[];
    invitedBy: string;
    joinedAt: Date;
    updatedAt: Date;
}
/**
 * User document for Firestore (global user record)
 */
export interface UserDocument {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    globalRole: 'superadmin' | 'user';
    createdAt: Date;
    lastLoginAt: Date;
}
/**
 * Firebase Custom Claims structure
 */
export interface CustomClaims {
    globalRole?: 'superadmin' | 'user';
    teams?: Record<string, Role>;
}
/**
 * Permission check options
 */
export interface PermissionCheckOptions {
    /** If true, allows if user has any higher role */
    allowHigherRoles?: boolean;
    /** Custom permissions to check against */
    customPermissions?: Permission[];
}
//# sourceMappingURL=rbac.types.d.ts.map