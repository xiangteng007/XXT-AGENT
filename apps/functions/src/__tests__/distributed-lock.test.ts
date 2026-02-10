/**
 * Unit Tests: Distributed Lock (V3 Audit #18)
 */

// Mock firebase-admin before imports
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
}));

const mockSet = jest.fn();
const mockDelete = jest.fn();
const mockGet = jest.fn();

jest.mock('firebase-admin/firestore', () => {
    const mockDocRef = { id: 'test-lock' };
    return {
        getFirestore: jest.fn(() => ({
            collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                    ...mockDocRef,
                    delete: mockDelete,
                })),
            })),
            runTransaction: jest.fn(async (fn: (t: { get: jest.Mock; set: jest.Mock }) => Promise<unknown>) => {
                return fn({ get: mockGet, set: mockSet });
            }),
        })),
        FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') },
        Timestamp: {
            now: jest.fn(() => ({ seconds: Math.floor(Date.now() / 1000) })),
        },
    };
});

jest.mock('firebase-functions/v2', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { withLock, acquireLock, releaseLock } from '../utils/distributed-lock';

describe('Distributed Lock', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should acquire lock when no existing lock', async () => {
        mockGet.mockResolvedValue({ exists: false });

        const callback = jest.fn().mockResolvedValue('result');
        const result = await withLock({ name: 'test', ttlSeconds: 60 }, callback);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(result).toBe('result');
        expect(mockSet).toHaveBeenCalled();
    });

    it('should skip execution if lock is held and not expired', async () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({
                lockedAt: { seconds: nowSeconds - 10 }, // locked 10s ago
                ttlSeconds: 300, // expires after 300s
            }),
        });

        const callback = jest.fn();
        const result = await withLock({ name: 'test', ttlSeconds: 300 }, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });

    it('should acquire lock if existing lock is expired', async () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({
                lockedAt: { seconds: nowSeconds - 600 }, // locked 600s ago
                ttlSeconds: 300, // expired (300s TTL)
            }),
        });

        const callback = jest.fn().mockResolvedValue('result');
        const result = await withLock({ name: 'test', ttlSeconds: 300 }, callback);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(result).toBe('result');
    });

    it('acquireLock returns false on transaction error', async () => {
        mockGet.mockRejectedValue(new Error('Firestore error'));
        const result = await acquireLock({ name: 'error-test' });
        expect(result).toBe(false);
    });

    it('releaseLock does not throw on error', async () => {
        mockDelete.mockRejectedValue(new Error('Delete failed'));
        await expect(releaseLock('test')).resolves.not.toThrow();
    });
});
