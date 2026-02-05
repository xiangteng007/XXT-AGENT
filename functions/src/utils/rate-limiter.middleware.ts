/**
 * Rate Limiter Middleware
 * 
 * Provides Firestore-based rate limiting for API endpoints.
 * Configuration: 100 requests per minute per user/IP.
 */

import { Request, Response, NextFunction } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per window
const RATE_LIMIT_COLLECTION = '_rate_limits';

interface RateLimitRecord {
    count: number;
    windowStart: Timestamp;
}

/**
 * Get identifier for rate limiting (userId or IP)
 */
function getIdentifier(req: Request): string {
    // First try to get user ID from auth header or session
    const authHeader = req.headers.authorization;
    if (authHeader) {
        // Use a hash of the auth token as identifier
        const tokenHash = Buffer.from(authHeader.substring(0, 50)).toString('base64');
        return `auth:${tokenHash}`;
    }

    // Fallback to IP address
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket?.remoteAddress || 
               'unknown';
    
    // Handle comma-separated IPs from proxies
    const clientIp = Array.isArray(ip) ? ip[0] : ip.split(',')[0].trim();
    return `ip:${clientIp}`;
}

/**
 * Rate Limiter Middleware Factory
 */
export function rateLimiter(options?: {
    maxRequests?: number;
    windowMs?: number;
    keyPrefix?: string;
}) {
    const maxRequests = options?.maxRequests || RATE_LIMIT_MAX_REQUESTS;
    const windowMs = options?.windowMs || RATE_LIMIT_WINDOW_MS;
    const keyPrefix = options?.keyPrefix || '';

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const db = getFirestore();
            const identifier = getIdentifier(req);
            const docId = `${keyPrefix}${identifier}`.replace(/[\/\.\#\$\[\]]/g, '_');
            const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(docId);

            const now = Timestamp.now();
            const windowStart = Timestamp.fromMillis(now.toMillis() - windowMs);

            // Transaction to atomically check and update rate limit
            const result = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                const data = doc.data() as RateLimitRecord | undefined;

                // Check if we're in a new window
                if (!data || data.windowStart.toMillis() < windowStart.toMillis()) {
                    // Start new window
                    transaction.set(docRef, {
                        count: 1,
                        windowStart: now,
                    });
                    return { allowed: true, remaining: maxRequests - 1 };
                }

                // Check if limit exceeded
                if (data.count >= maxRequests) {
                    return { 
                        allowed: false, 
                        remaining: 0,
                        retryAfter: Math.ceil((data.windowStart.toMillis() + windowMs - now.toMillis()) / 1000)
                    };
                }

                // Increment counter
                transaction.update(docRef, {
                    count: data.count + 1,
                });

                return { allowed: true, remaining: maxRequests - data.count - 1 };
            });

            // Set rate limit headers
            res.set('X-RateLimit-Limit', maxRequests.toString());
            res.set('X-RateLimit-Remaining', result.remaining.toString());
            res.set('X-RateLimit-Reset', Math.ceil((Date.now() + windowMs) / 1000).toString());

            if (!result.allowed) {
                res.set('Retry-After', result.retryAfter?.toString() || '60');
                res.status(429).json({
                    error: 'Too Many Requests',
                    message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
                    retryAfter: result.retryAfter,
                });
                return;
            }

            next();
        } catch (error) {
            // On error, allow request but log warning
            console.warn('[RateLimiter] Error checking rate limit:', error);
            next();
        }
    };
}

/**
 * Cleanup old rate limit records (call periodically)
 */
export async function cleanupRateLimits(): Promise<number> {
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(Date.now() - RATE_LIMIT_WINDOW_MS * 2);

    const query = db.collection(RATE_LIMIT_COLLECTION)
        .where('windowStart', '<', cutoff)
        .limit(500);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
        return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[RateLimiter] Cleaned up ${snapshot.size} expired records`);
    return snapshot.size;
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
    // Standard API rate limit: 100 req/min
    standard: rateLimiter(),
    
    // Strict limit for sensitive operations: 10 req/min
    strict: rateLimiter({ maxRequests: 10, keyPrefix: 'strict:' }),
    
    // Webhook rate limit: 1000 req/min (higher for LINE webhooks)
    webhook: rateLimiter({ maxRequests: 1000, keyPrefix: 'webhook:' }),
    
    // AI operations: 20 req/min (to manage costs)
    ai: rateLimiter({ maxRequests: 20, keyPrefix: 'ai:' }),
};
