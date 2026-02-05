"use strict";
/**
 * RBAC Service - Role-Based Access Control
 * Core authorization logic for XXT-AGENT platform
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const rbac_types_1 = require("../types/rbac.types");
const permissions_config_1 = require("../config/permissions.config");
const db = (0, firestore_1.getFirestore)();
const auth = (0, auth_1.getAuth)();
/**
 * RBAC Service singleton
 */
class RBACService {
    userCache = new Map();
    CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    /**
     * Get user context from Firebase Auth and Firestore
     */
    async getUserContext(userId) {
        // Check cache first
        const cached = this.userCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.context;
        }
        try {
            // Get user from Firebase Auth
            const userRecord = await auth.getUser(userId);
            const claims = userRecord.customClaims;
            // Get user document
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            // Get team memberships
            const teamMemberships = await this.getTeamMemberships(userId);
            const context = {
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
        }
        catch (error) {
            console.error('Failed to get user context:', error);
            return null;
        }
    }
    /**
     * Get all team memberships for a user
     */
    async getTeamMemberships(userId) {
        const memberships = [];
        try {
            // Query all teams where user is a member
            const teamsSnapshot = await db.collectionGroup('members')
                .where('userId', '==', userId)
                .get();
            for (const doc of teamsSnapshot.docs) {
                const memberData = doc.data();
                const teamId = doc.ref.parent.parent?.id;
                if (!teamId)
                    continue;
                // Get team name
                const teamDoc = await db.collection('teams').doc(teamId).get();
                const teamName = teamDoc.data()?.name || 'Unknown Team';
                memberships.push({
                    teamId,
                    teamName,
                    role: memberData.role,
                    permissions: (0, permissions_config_1.getRolePermissions)(memberData.role),
                    joinedAt: memberData.joinedAt,
                });
            }
        }
        catch (error) {
            console.error('Failed to get team memberships:', error);
        }
        return memberships;
    }
    /**
     * Check if user is authorized for a specific action
     */
    async authorize(context) {
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
            const allowed = (0, permissions_config_1.hasPermission)(membership.role, resource, action);
            if (!allowed) {
                return {
                    allowed: false,
                    reason: `角色「${permissions_config_1.ROLE_DISPLAY_NAMES[membership.role]}」無法執行此操作`,
                    requiredRole: this.getMinimumRequiredRole(resource, action),
                    userRole: membership.role,
                };
            }
            return { allowed: true };
        }
        // For global resources (no team context), check if user has any role that allows the action
        for (const membership of user.teamMemberships) {
            if ((0, permissions_config_1.hasPermission)(membership.role, resource, action)) {
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
    checkPermission(userRole, resource, action) {
        return (0, permissions_config_1.hasPermission)(userRole, resource, action);
    }
    /**
     * Compare roles by hierarchy
     */
    compareRoles(role1, role2) {
        return rbac_types_1.ROLE_HIERARCHY[role1] - rbac_types_1.ROLE_HIERARCHY[role2];
    }
    /**
     * Check if role1 is higher than or equal to role2
     */
    isRoleHigherOrEqual(role1, role2) {
        return rbac_types_1.ROLE_HIERARCHY[role1] >= rbac_types_1.ROLE_HIERARCHY[role2];
    }
    /**
     * Get minimum role required for an action
     */
    getMinimumRequiredRole(resource, action) {
        const roleOrder = ['viewer', 'editor', 'admin', 'owner', 'superadmin'];
        for (const role of roleOrder) {
            if ((0, permissions_config_1.hasPermission)(role, resource, action)) {
                return role;
            }
        }
        return 'superadmin';
    }
    /**
     * Set custom claims for a user (Firebase Auth)
     */
    async setUserClaims(userId, claims) {
        try {
            const currentUser = await auth.getUser(userId);
            const currentClaims = (currentUser.customClaims || {});
            await auth.setCustomUserClaims(userId, {
                ...currentClaims,
                ...claims,
            });
            // Invalidate cache
            this.userCache.delete(userId);
        }
        catch (error) {
            console.error('Failed to set user claims:', error);
            throw error;
        }
    }
    /**
     * Add user to team with role
     */
    async addTeamMember(teamId, userId, email, displayName, role, invitedBy) {
        const memberDoc = {
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
        const currentClaims = (userRecord.customClaims || {});
        const teams = currentClaims.teams || {};
        teams[teamId] = role;
        await this.setUserClaims(userId, { teams });
    }
    /**
     * Update member role
     */
    async updateMemberRole(teamId, userId, newRole) {
        await db.collection('teams').doc(teamId).collection('members').doc(userId).update({
            role: newRole,
            updatedAt: new Date(),
        });
        // Update custom claims
        const userRecord = await auth.getUser(userId);
        const currentClaims = (userRecord.customClaims || {});
        const teams = currentClaims.teams || {};
        teams[teamId] = newRole;
        await this.setUserClaims(userId, { teams });
    }
    /**
     * Remove member from team
     */
    async removeTeamMember(teamId, userId) {
        await db.collection('teams').doc(teamId).collection('members').doc(userId).delete();
        // Update custom claims
        const userRecord = await auth.getUser(userId);
        const currentClaims = (userRecord.customClaims || {});
        const teams = { ...(currentClaims.teams || {}) };
        delete teams[teamId];
        await this.setUserClaims(userId, { teams });
    }
    /**
     * Clear user cache (for testing or forced refresh)
     */
    clearCache(userId) {
        if (userId) {
            this.userCache.delete(userId);
        }
        else {
            this.userCache.clear();
        }
    }
}
// Export singleton instance
exports.rbacService = new RBACService();
exports.default = exports.rbacService;
//# sourceMappingURL=rbac.service.js.map