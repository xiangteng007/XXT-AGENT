/**
 * RBAC Service - Role-Based Access Control
 * Core authorization logic for XXT-AGENT platform
 */

import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
    Role,
    Resource,
    Action,
    UserContext,
    TeamMembership,
    AuthResult,
    RBACContext,
    TeamMemberDocument,
    UserDocument,
    CustomClaims,
    ROLE_HIERARCHY,
} from '../types/rbac.types';
import {
    hasPermission,
    getRolePermissions,
    ROLE_DISPLAY_NAMES,
} from '../config/permissions.config';

const db = getFirestore();
const auth = getAuth();

/**
 * RBAC Service singleton
 */
class RBACService {
    private userCache: Map<string, { context: UserContext; expiresAt: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get user context from Firebase Auth and Firestore
     */
    async getUserContext(userId: string): Promise<UserContext | null> {
        // Check cache first
        const cached = this.userCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.context;
        }

        try {
            // Get user from Firebase Auth
            const userRecord = await auth.getUser(userId);
            const claims = userRecord.customClaims as CustomClaims | undefined;

            // Get user document
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data() as UserDocument | undefined;

            // Get team memberships
            const teamMemberships = await this.getTeamMemberships(userId);

            const context: UserContext = {
                userId,
                email: userRecord.email || '',
                displayName: userRecord.displayName || userData?.displayName || '',
                globalRole: claims?.globalRole || userData?.globalRole || 'user',
                teamMemberships,
            };

            // Cache the result
            this.userCache.set(userId, {
                context,
                expiresAt: Date.now() + this.CACHE_TTL,
            });

            return context;
        } catch (error) {
            console.error('Failed to get user context:', error);
            return null;
        }
    }

    /**
     * Get all team memberships for a user
     */
    private async getTeamMemberships(userId: string): Promise<TeamMembership[]> {
        const memberships: TeamMembership[] = [];

        try {
            // Query all teams where user is a member
            const teamsSnapshot = await db.collectionGroup('members')
                .where('userId', '==', userId)
                .get();

            for (const doc of teamsSnapshot.docs) {
                const memberData = doc.data() as TeamMemberDocument;
                const teamId = doc.ref.parent.parent?.id;
                
                if (!teamId) continue;

                // Get team name
                const teamDoc = await db.collection('teams').doc(teamId).get();
                const teamName = teamDoc.data()?.name || 'Unknown Team';

                memberships.push({
                    teamId,
                    teamName,
                    role: memberData.role,
                    permissions: getRolePermissions(memberData.role),
                    joinedAt: memberData.joinedAt,
                });
            }
        } catch (error) {
            console.error('Failed to get team memberships:', error);
        }

        return memberships;
    }

    /**
     * Check if user is authorized for a specific action
     */
    async authorize(context: RBACContext): Promise<AuthResult> {
        const { user, teamId, resource, action } = context;

        // Superadmin bypass - allowed for everything
        if (user.globalRole === 'superadmin') {
            return { allowed: true };
        }

        // For team-scoped resources, check team membership
        if (teamId) {
            const membership = user.teamMemberships.find(m => m.teamId === teamId);
            
            if (!membership) {
                return {
                    allowed: false,
                    reason: '您不是此團隊的成員',
                };
            }

            const allowed = hasPermission(membership.role, resource, action);
            
            if (!allowed) {
                return {
                    allowed: false,
                    reason: `角色「${ROLE_DISPLAY_NAMES[membership.role]}」無法執行此操作`,
                    requiredRole: this.getMinimumRequiredRole(resource, action),
                    userRole: membership.role,
                };
            }

            return { allowed: true };
        }

        // For global resources (no team context), check if user has any role that allows the action
        for (const membership of user.teamMemberships) {
            if (hasPermission(membership.role, resource, action)) {
                return { allowed: true };
            }
        }

        return {
            allowed: false,
            reason: '您沒有權限執行此操作',
        };
    }

    /**
     * Quick permission check (synchronous, using cached context)
     */
    checkPermission(userRole: Role, resource: Resource, action: Action): boolean {
        return hasPermission(userRole, resource, action);
    }

    /**
     * Compare roles by hierarchy
     */
    compareRoles(role1: Role, role2: Role): number {
        return ROLE_HIERARCHY[role1] - ROLE_HIERARCHY[role2];
    }

    /**
     * Check if role1 is higher than or equal to role2
     */
    isRoleHigherOrEqual(role1: Role, role2: Role): boolean {
        return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
    }

    /**
     * Get minimum role required for an action
     */
    private getMinimumRequiredRole(resource: Resource, action: Action): Role {
        const roleOrder: Role[] = ['viewer', 'editor', 'admin', 'owner', 'superadmin'];
        
        for (const role of roleOrder) {
            if (hasPermission(role, resource, action)) {
                return role;
            }
        }
        
        return 'superadmin';
    }

    /**
     * Set custom claims for a user (Firebase Auth)
     */
    async setUserClaims(userId: string, claims: Partial<CustomClaims>): Promise<void> {
        try {
            const currentUser = await auth.getUser(userId);
            const currentClaims = (currentUser.customClaims || {}) as CustomClaims;
            
            await auth.setCustomUserClaims(userId, {
                ...currentClaims,
                ...claims,
            });

            // Invalidate cache
            this.userCache.delete(userId);
        } catch (error) {
            console.error('Failed to set user claims:', error);
            throw error;
        }
    }

    /**
     * Add user to team with role
     */
    async addTeamMember(
        teamId: string,
        userId: string,
        email: string,
        displayName: string,
        role: Role,
        invitedBy: string
    ): Promise<void> {
        const memberDoc: TeamMemberDocument = {
            userId,
            email,
            displayName,
            role,
            invitedBy,
            joinedAt: new Date(),
            updatedAt: new Date(),
        };

        await db.collection('teams').doc(teamId).collection('members').doc(userId).set(memberDoc);

        // Update custom claims
        const userRecord = await auth.getUser(userId);
        const currentClaims = (userRecord.customClaims || {}) as CustomClaims;
        const teams = currentClaims.teams || {};
        teams[teamId] = role;

        await this.setUserClaims(userId, { teams });
    }

    /**
     * Update member role
     */
    async updateMemberRole(teamId: string, userId: string, newRole: Role): Promise<void> {
        await db.collection('teams').doc(teamId).collection('members').doc(userId).update({
            role: newRole,
            updatedAt: new Date(),
        });

        // Update custom claims
        const userRecord = await auth.getUser(userId);
        const currentClaims = (userRecord.customClaims || {}) as CustomClaims;
        const teams = currentClaims.teams || {};
        teams[teamId] = newRole;

        await this.setUserClaims(userId, { teams });
    }

    /**
     * Remove member from team
     */
    async removeTeamMember(teamId: string, userId: string): Promise<void> {
        await db.collection('teams').doc(teamId).collection('members').doc(userId).delete();

        // Update custom claims
        const userRecord = await auth.getUser(userId);
        const currentClaims = (userRecord.customClaims || {}) as CustomClaims;
        const teams: Record<string, Role> = { ...(currentClaims.teams || {}) };
        delete teams[teamId];

        await this.setUserClaims(userId, { teams });
    }

    /**
     * Clear user cache (for testing or forced refresh)
     */
    clearCache(userId?: string): void {
        if (userId) {
            this.userCache.delete(userId);
        } else {
            this.userCache.clear();
        }
    }
}

// Export singleton instance
export const rbacService = new RBACService();
export default rbacService;
