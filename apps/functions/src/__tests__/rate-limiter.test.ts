/**
 * Rate Limiter Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import { rateLimiter, rateLimiters, cleanupRateLimits } from '../utils/rate-limiter.middleware';

// Mock Firestore
jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn(),
                set: jest.fn(),
                update: jest.fn(),
            })),
            where: jest.fn(() => ({
                limit: jest.fn(() => ({
                    get: jest.fn(() => Promise.resolve({ empty: true, docs: [] })),
                })),
            })),
        })),
        runTransaction: jest.fn((callback) => callback({
            get: jest.fn(() => Promise.resolve({ data: () => undefined })),
            set: jest.fn(),
            update: jest.fn(),
        })),
        batch: jest.fn(() => ({
            delete: jest.fn(),
            commit: jest.fn(),
        })),
    })),
    Timestamp: {
        now: jest.fn(() => ({ toMillis: () => Date.now() })),
        fromMillis: jest.fn((ms) => ({ toMillis: () => ms })),
    },
}));

describe('Rate Limiter Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            headers: {},
            socket: { remoteAddress: '127.0.0.1' } as any,
        };
        mockRes = {
            set: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        mockNext = jest.fn();
    });

    describe('rateLimiter factory', () => {
        it('should create a middleware function', () => {
            const middleware = rateLimiter();
            expect(typeof middleware).toBe('function');
        });

        it('should accept custom options', () => {
            const middleware = rateLimiter({
                maxRequests: 50,
                windowMs: 30000,
                keyPrefix: 'test:',
            });
            expect(typeof middleware).toBe('function');
        });
    });

    describe('rateLimiters presets', () => {
        it('should have standard preset', () => {
            expect(rateLimiters.standard).toBeDefined();
            expect(typeof rateLimiters.standard).toBe('function');
        });

        it('should have strict preset', () => {
            expect(rateLimiters.strict).toBeDefined();
        });

        it('should have webhook preset', () => {
            expect(rateLimiters.webhook).toBeDefined();
        });

        it('should have ai preset', () => {
            expect(rateLimiters.ai).toBeDefined();
        });
    });

    describe('rate limiting behavior', () => {
        it('should call next() when under limit', async () => {
            const middleware = rateLimiter();
            await middleware(mockReq as Request, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should set rate limit headers', async () => {
            const middleware = rateLimiter();
            await middleware(mockReq as Request, mockRes as Response, mockNext);
            expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
            expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
        });
    });

    describe('identifier extraction', () => {
        it('should use authorization header when available', async () => {
            mockReq.headers = { authorization: 'Bearer test-token-123' };
            const middleware = rateLimiter();
            await middleware(mockReq as Request, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should use IP when no auth header', async () => {
            mockReq.headers = {};
            const middleware = rateLimiter();
            await middleware(mockReq as Request, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle x-forwarded-for header', async () => {
            mockReq.headers = { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' };
            const middleware = rateLimiter();
            await middleware(mockReq as Request, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('cleanupRateLimits', () => {
        it('should return number of cleaned records', async () => {
            const count = await cleanupRateLimits();
            expect(typeof count).toBe('number');
        });
    });
});
