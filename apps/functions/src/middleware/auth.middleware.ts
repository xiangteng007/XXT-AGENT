/**
 * Authentication Middleware
 * Verifies Firebase Auth tokens and injects user context
 */

import { logger } from 'firebase-functions/v2';
import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { rbacService } from '../services/rbac.service';
import { UserContext, CustomClaims } from '../types/rbac.types';

const auth = getAuth();

/**
 * Extended Express Request with user context
 */
export interface AuthenticatedRequest extends Request {
    user?: UserContext;
    userId?: string;
    teamId?: string;
}

/**
 * Authentication options
 */
interface AuthOptions {
    /** Whether to require authentication (default: true) */
    required?: boolean;
    /** Whether to load full user context (default: true) */
    loadContext?: boolean;
}

/**
 * Create authentication middleware
 */
export function authenticate(options: AuthOptions = {}): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    const { required = true, loadContext = true } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const authReq = req as AuthenticatedRequest;

        try {
            // Extract token from Authorization header
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                if (required) {
                    res.status(401).json({
                        success: false,
                        error: 'Unauthorized',
                        message: '缺少認證令牌',
                    });
                    return;
                }
                next();
                return;
            }

            const token = authHeader.split('Bearer ')[1];

            // Verify Firebase ID token
            const decodedToken = await auth.verifyIdToken(token);
            
            authReq.userId = decodedToken.uid;

            // Extract team ID from headers or query params
            authReq.teamId = (req.headers['x-team-id'] as string) || (req.query.teamId as string);

            // Load full user context if needed
            if (loadContext) {
                const userContext = await rbacService.getUserContext(decodedToken.uid);
                
                if (!userContext) {
                    if (required) {
                        res.status(401).json({
                            success: false,
                            error: 'Unauthorized',
                            message: '無法獲取用戶資訊',
                        });
                        return;
                    }
                } else {
                    authReq.user = userContext;
                }
            } else {
                // Minimal user context from token claims
                const claims = decodedToken as unknown as CustomClaims;
                authReq.user = {
                    userId: decodedToken.uid,
                    email: decodedToken.email || '',
                    displayName: decodedToken.name || '',
                    globalRole: claims.globalRole || 'user',
                    teamMemberships: [],
                };
            }

            next();
        } catch (error) {
            logger.error('Authentication error:', error);

            if (required) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    message: '認證令牌無效或已過期',
                });
                return;
            }

            next();
        }
    };
}

/**
 * Middleware to require a specific team context
 */
export function requireTeam(req: Request, res: Response, next: NextFunction): void {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.teamId) {
        res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: '缺少團隊 ID (X-Team-Id header 或 teamId query param)',
        });
        return;
    }

    // Verify user is member of the team
    if (authReq.user) {
        const membership = authReq.user.teamMemberships.find(m => m.teamId === authReq.teamId);
        
        if (!membership && authReq.user.globalRole !== 'superadmin') {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: '您不是此團隊的成員',
            });
            return;
        }
    }

    next();
}

/**
 * Middleware to require superadmin role
 */
export function requireSuperadmin(req: Request, res: Response, next: NextFunction): void {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user || authReq.user.globalRole !== 'superadmin') {
        res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: '此操作需要系統管理員權限',
        });
        return;
    }

    next();
}

/**
 * Get current user's role in a specific team
 */
export function getCurrentTeamRole(req: AuthenticatedRequest): string | null {
    if (!req.user || !req.teamId) return null;
    
    if (req.user.globalRole === 'superadmin') return 'superadmin';
    
    const membership = req.user.teamMemberships.find(m => m.teamId === req.teamId);
    return membership?.role || null;
}
