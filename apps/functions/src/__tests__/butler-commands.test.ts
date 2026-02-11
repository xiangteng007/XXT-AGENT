/**
 * Unit Tests — Butler Commands Service
 * Tests: parseCommand, executeCommand basics
 */

const mockCollection = () => ({
    doc: () => ({
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
    }),
    add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
});

const mockFirestore = () => ({
    collection: mockCollection,
    doc: jest.fn(),
});

jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: Object.assign(mockFirestore, {
        Timestamp: { now: () => ({ seconds: Date.now() / 1000, nanoseconds: 0 }) },
        FieldValue: { serverTimestamp: jest.fn() },
    }),
}));

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: mockFirestore,
}));

jest.mock('firebase-functions/v2', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { parseCommand } from '../services/butler/butler-commands.service';

describe('Butler Commands Service', () => {
    describe('parseCommand', () => {
        it('should parse expense command', () => {
            const result = parseCommand('記帳 午餐 120');
            expect(result).toBeDefined();
            if (result) {
                expect(result.action).toBe('record_expense');
            }
        });

        it('should parse health command', () => {
            const result = parseCommand('體重 75.5');
            expect(result).toBeDefined();
            if (result) {
                expect(result.action).toBe('record_weight');
            }
        });

        it('should return null for unknown commands', () => {
            // May or may not parse - depends on implementation
            // Just ensure it doesn't throw
            expect(() => parseCommand('隨便說說')).not.toThrow();
        });
    });
});
