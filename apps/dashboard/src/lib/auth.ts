/**
 * Auth utilities and types
 */
import { getAdminAuth, getAdminDb } from './firebase-admin';
import { NextRequest } from 'next/server';

export interface AdminUser {
    uid: string;
    email: string;
    enabled: boolean;
    role: 'owner' | 'admin' | 'viewer';
    allowTenants: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface AuthResult {
    success: boolean;
    user?: AdminUser;
    error?: string;
}

/**
 * Verify Firebase ID Token from Authorization header
 */
export async function verifyAuthToken(req: NextRequest): Promise<AuthResult> {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return { success: false, error: 'Missing or invalid Authorization header' };
    }

    const idToken = authHeader.substring(7);

    try {
        const auth = getAdminAuth();
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const email = decodedToken.email || '';

        // Check admin record
        const db = getAdminDb();
        const adminDoc = await db.collection('admins').doc(uid).get();

        if (!adminDoc.exists) {
            return { success: false, error: 'User not in admin list' };
        }

        const adminData = adminDoc.data();
        if (!adminData?.enabled) {
            return { success: false, error: 'Admin account disabled' };
        }

        const user: AdminUser = {
            uid,
            email,
            enabled: adminData.enabled,
            role: adminData.role || 'viewer',
            allowTenants: adminData.allowTenants || [],
            createdAt: adminData.createdAt?.toDate() || new Date(),
            updatedAt: adminData.updatedAt?.toDate() || new Date(),
        };

        return { success: true, user };

    } catch (error) {
        console.error('Auth verification error:', error);
        return { success: false, error: 'Invalid token' };
    }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AdminUser, requiredRoles: ('owner' | 'admin' | 'viewer')[]): boolean {
    return requiredRoles.includes(user.role);
}

/**
 * Check if user can access tenant
 */
export function canAccessTenant(user: AdminUser, tenantId: string): boolean {
    // Empty allowTenants means access to all
    if (user.allowTenants.length === 0) return true;
    return user.allowTenants.includes(tenantId);
}

/**
 * Simplified verifyAuth for API routes
 * Returns { success, uid, role, error } for easier API usage
 */
export async function verifyAuth(req: NextRequest): Promise<{
    success: boolean;
    uid: string;
    role: 'owner' | 'admin' | 'viewer';
    error?: string;
}> {
    const result = await verifyAuthToken(req);
    if (!result.success || !result.user) {
        return { success: false, uid: '', role: 'viewer', error: result.error };
    }
    return {
        success: true,
        uid: result.user.uid,
        role: result.user.role
    };
}
