/**
 * Butler AI Service Tests
 * Note: These tests run in CI without real API keys.
 * We verify the function interface (types, no throws) not actual AI output.
 */

import { generateAIResponse, isAIAvailable } from '../services/butler-ai.service';

// Mocks are handled in jest.setup.ts

describe('Butler AI Service', () => {
    describe('generateAIResponse', () => {
        it('should return a string for schedule-related queries', async () => {
            const response = await generateAIResponse('今天行程');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should return a string for finance-related queries', async () => {
            const response = await generateAIResponse('這個月支出多少');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should return a string for vehicle-related queries', async () => {
            const response = await generateAIResponse('車子該保養了嗎');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should return a string for health-related queries', async () => {
            const response = await generateAIResponse('今日健康');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should return a string for business-related queries', async () => {
            const response = await generateAIResponse('專案狀態');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should return a string for help queries', async () => {
            const response = await generateAIResponse('幫助');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should handle unknown queries gracefully without throwing', async () => {
            const response = await generateAIResponse('隨機問題測試');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should accept optional userId parameter', async () => {
            const response = await generateAIResponse('你好', 'test-user-123');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });
    });

    describe('isAIAvailable', () => {
        it('should return a boolean', async () => {
            const available = await isAIAvailable();
            expect(typeof available).toBe('boolean');
        });
    });
});
