/**
 * RBAC Service - Role-Based Access Control
 * Core authorization logic for XXT-AGENT platform
 */
import { Role, Resource, Action, UserContext, AuthResult, RBACContext, CustomClaims } from '../types/rbac.types';
/**
 * RBAC Service singleton
 */
declare class RBACService {
    private userCache;
    private readonly CACHE_TTL;
    /**
     * Get user context from Firebase Auth and Firestore
     */
    getUserContext(userId: string): Promise<UserContext | null>;
    /**
     * Get all team memberships for a user
     */
    private getTeamMemberships;
    /**
     * Check if user is authorized for a specific action
     */
    authorize(context: RBACContext): Promise<AuthResult>;
    /**
     * Quick permission check (synchronous, using cached context)
     */
    checkPermission(userRole: Role, resource: Resource, action: Action): boolean;
    /**
     * Compare roles by hierarchy
     */
    compareRoles(role1: Role, role2: Role): number;
    /**
     * Check if role1 is higher than or equal to role2
     */
    isRoleHigherOrEqual(role1: Role, role2: Role): boolean;
    /**
     * Get minimum role required for an action
     */
    private getMinimumRequiredRole;
    /**
     * Set custom claims for a user (Firebase Auth)
     */
    setUserClaims(userId: string, claims: Partial<CustomClaims>): Promise<void>;
    /**
     * Add user to team with role
     */
    addTeamMember(teamId: string, userId: string, email: string, displayName: string, role: Role, invitedBy: string): Promise<void>;
    /**
     * Update member role
     */
    updateMemberRole(teamId: string, userId: string, newRole: Role): Promise<void>;
    /**
     * Remove member from team
     */
    removeTeamMember(teamId: string, userId: string): Promise<void>;
    /**
     * Clear user cache (for testing or forced refresh)
     */
    clearCache(userId?: string): void;
}
export declare const rbacService: RBACService;
export default rbacService;
//# sourceMappingURL=rbac.service.d.ts.map