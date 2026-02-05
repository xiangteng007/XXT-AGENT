/**
 * Rate Limiter Middleware
 *
 * Provides Firestore-based rate limiting for API endpoints.
 * Configuration: 100 requests per minute per user/IP.
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Rate Limiter Middleware Factory
 */
export declare function rateLimiter(options?: {
    maxRequests?: number;
    windowMs?: number;
    keyPrefix?: string;
}): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Cleanup old rate limit records (call periodically)
 */
export declare function cleanupRateLimits(): Promise<number>;
/**
 * Pre-configured rate limiters for common use cases
 */
export declare const rateLimiters: {
    standard: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    strict: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    webhook: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    ai: (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
//# sourceMappingURL=rate-limiter.middleware.d.ts.map