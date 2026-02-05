/**
 * Authentication Middleware
 * Verifies Firebase Auth tokens and injects user context
 */
import { Request, Response, NextFunction } from 'express';
import { UserContext } from '../types/rbac.types';
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
export declare function authenticate(options?: AuthOptions): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to require a specific team context
 */
export declare function requireTeam(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware to require superadmin role
 */
export declare function requireSuperadmin(req: Request, res: Response, next: NextFunction): void;
/**
 * Get current user's role in a specific team
 */
export declare function getCurrentTeamRole(req: AuthenticatedRequest): string | null;
export {};
//# sourceMappingURL=auth.middleware.d.ts.map