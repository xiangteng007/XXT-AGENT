/**
 * Butler AI Service Tests
 */

import { generateAIResponse, isAIAvailable } from '../services/butler-ai.service';

// Mock Gemini client
jest.mock('@google/generative-ai');
jest.mock('@google-cloud/secret-manager');

describe('Butler AI Service', () => {
    describe('generateAIResponse', () => {
        it('should return a response for schedule-related queries', async () => {
            const response = await generateAIResponse('今天行程');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        });

        it('should return a response for finance-related queries', async () => {
            const response = await generateAIResponse('這個月支出多少');
            expect(response).toBeDefined();
            expect(response).toContain('財務');
        });

        it('should return a response for vehicle-related queries', async () => {
            const response = await generateAIResponse('車子該保養了嗎');
            expect(response).toBeDefined();
        });

        it('should return a response for health-related queries', async () => {
            const response = await generateAIResponse('今日健康');
            expect(response).toBeDefined();
            expect(response).toContain('健康');
        });

        it('should return a response for business-related queries', async () => {
            const response = await generateAIResponse('專案狀態');
            expect(response).toBeDefined();
        });

        it('should return help information when asked', async () => {
            const response = await generateAIResponse('幫助');
            expect(response).toBeDefined();
        });

        it('should handle unknown queries gracefully', async () => {
            const response = await generateAIResponse('隨機問題測試');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should accept optional userId parameter', async () => {
            const response = await generateAIResponse('你好', 'test-user-123');
            expect(response).toBeDefined();
        });
    });

    describe('isAIAvailable', () => {
        it('should return a boolean', async () => {
            const available = await isAIAvailable();
            expect(typeof available).toBe('boolean');
        });
    });
});
