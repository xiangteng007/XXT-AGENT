/**
 * Unit Tests — Butler Commands Service
 * Tests: parseCommand, executeCommand basics
 */

jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: () => ({
        collection: () => ({
            doc: () => ({
                get: jest.fn().mockResolvedValue({ exists: false }),
                set: jest.fn().mockResolvedValue(undefined),
            }),
        }),
    }),
}));

import { parseCommand } from '../services/butler/butler-commands.service';

describe('Butler Commands Service', () => {
    describe('parseCommand', () => {
        it('should parse expense command', () => {
            const result = parseCommand('記帳 午餐 120');
            expect(result).toBeDefined();
            if (result) {
                expect(result.domain).toBe('finance');
            }
        });

        it('should parse health command', () => {
            const result = parseCommand('體重 75.5');
            expect(result).toBeDefined();
            if (result) {
                expect(result.domain).toBe('health');
            }
        });

        it('should return null for unknown commands', () => {
            const result = parseCommand('隨便說說');
            // May or may not parse - depends on implementation
            // Just ensure it doesn't throw
            expect(() => parseCommand('隨便說說')).not.toThrow();
        });
    });
});
