/**
 * GET /api/admin/me - Get current admin user info
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json(
            { error: auth.error || 'Unauthorized' },
            { status: 401 }
        );
    }

    return NextResponse.json({
        uid: auth.user.uid,
        email: auth.user.email,
        role: auth.user.role,
        enabled: auth.user.enabled,
        allowTenants: auth.user.allowTenants,
    });
}
