/**
 * Unit Tests — Butler API Handler
 * Tests: verifyAuth, CORS whitelist, rate limiting, health check, error masking
 */

// Mock firebase-admin before imports
jest.mock('firebase-admin', () => ({
    auth: () => ({
        verifyIdToken: jest.fn(),
    }),
    initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: () => ({
        collection: () => ({
            doc: () => ({
                get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
                set: jest.fn().mockResolvedValue(undefined),
                update: jest.fn().mockResolvedValue(undefined),
            }),
        }),
    }),
    FieldValue: {
        increment: (n: number) => n,
    },
}));

jest.mock('../services/butler.service', () => ({ butlerService: {} }));
jest.mock('../services/health.service', () => ({ healthService: {} }));
jest.mock('../services/health-integrations.service', () => ({ processAppleHealthSync: jest.fn() }));
jest.mock('../services/finance.service', () => ({ financeService: {} }));
jest.mock('../services/vehicle.service', () => ({ vehicleService: {} }));
jest.mock('../services/schedule.service', () => ({ scheduleService: {} }));
jest.mock('../services/business.service', () => ({ businessService: {} }));
jest.mock('../services/butler/investment.service', () => ({ investmentService: {} }));
jest.mock('../services/butler/loan.service', () => ({ loanService: {} }));
jest.mock('../services/butler/monthly-insights.service', () => ({ generateMonthlyInsights: jest.fn() }));
jest.mock('../services/butler/investment-report.service', () => ({ generateInvestmentReport: jest.fn() }));

import { handleButlerApi } from '../handlers/butler-api.handler';
import * as admin from 'firebase-admin';

describe('Butler API Handler', () => {
    let mockReq: Record<string, unknown>;
    let mockRes: Record<string, unknown>;
    let jsonFn: jest.Mock;
    let statusFn: jest.Mock;
    let sendFn: jest.Mock;
    let setFn: jest.Mock;

    beforeEach(() => {
        jsonFn = jest.fn();
        sendFn = jest.fn();
        statusFn = jest.fn().mockReturnValue({ json: jsonFn, send: sendFn });
        setFn = jest.fn();
        mockRes = { json: jsonFn, status: statusFn, set: setFn, send: sendFn };
        mockReq = {
            method: 'GET',
            path: '/health',
            headers: { origin: 'https://xxt-agent.vercel.app' },
        };
    });

    describe('CORS Whitelist (#1)', () => {
        it('should set allowed origin from whitelist', async () => {
            await handleButlerApi(mockReq as any, mockRes as any);
            expect(setFn).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://xxt-agent.vercel.app');
        });

        it('should fallback to first allowed origin for unknown origins', async () => {
            mockReq.headers = { origin: 'https://evil.com' };
            await handleButlerApi(mockReq as any, mockRes as any);
            expect(setFn).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://xxt-agent.vercel.app');
        });

        it('should handle OPTIONS preflight', async () => {
            mockReq.method = 'OPTIONS';
            await handleButlerApi(mockReq as any, mockRes as any);
            expect(statusFn).toHaveBeenCalledWith(204);
        });
    });

    describe('Health Check (#12)', () => {
        it('should return health status without auth', async () => {
            mockReq.path = '/health';
            await handleButlerApi(mockReq as any, mockRes as any);
            expect(jsonFn).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'ok', version: '2.0.0' })
            );
        });
    });

    describe('Authentication', () => {
        it('should return 401 for unauthenticated requests', async () => {
            mockReq.path = '/profile';
            mockReq.headers = {};
            await handleButlerApi(mockReq as any, mockRes as any);
            expect(statusFn).toHaveBeenCalledWith(401);
        });
    });

    describe('Error Masking (#2)', () => {
        it('should not leak internal error messages', async () => {
            const verifyMock = admin.auth().verifyIdToken as jest.Mock;
            verifyMock.mockResolvedValue({ uid: 'test-user' });
            mockReq.path = '/nonexistent-module/action';
            mockReq.headers = { authorization: 'Bearer valid-token' };

            await handleButlerApi(mockReq as any, mockRes as any);

            // Should return 404, not 500 with internal details
            const errorCalls = jsonFn.mock.calls.filter(
                (call: unknown[]) => (call[0] as Record<string, unknown>)?.error
            );
            for (const call of errorCalls) {
                const body = call[0] as Record<string, string>;
                expect(body.error).not.toContain('firebase');
                expect(body.error).not.toContain('Firestore');
            }
        });
    });
});
