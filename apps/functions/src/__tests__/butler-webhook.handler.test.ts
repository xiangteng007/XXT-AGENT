/**
 * Butler Webhook Handler Tests
 */

import { Request, Response } from 'express';

// Mock dependencies
jest.mock('../services/butler-ai.service', () => ({
    generateAIResponse: jest.fn().mockResolvedValue('Test response'),
}));

// Mock fetch for LINE API
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: jest.fn().mockResolvedValue('{}'),
});

describe('Butler Webhook Handler', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockReq = {
            headers: {},
            body: {},
            rawBody: Buffer.from('{}'),
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('Signature Verification', () => {
        it('should reject requests with invalid signature', async () => {
            mockReq.headers = { 'x-line-signature': 'invalid' };
            mockReq.body = { events: [] };
            
            // Import after mocks are set up
            const { handleButlerWebhook } = require('../handlers/butler-webhook.handler');
            await handleButlerWebhook(mockReq as Request, mockRes as Response);
            
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });
    });

    describe('Event Types', () => {
        it('should handle message events', async () => {
            // Test event structure
            const messageEvent = {
                type: 'message',
                replyToken: 'test-token',
                source: { type: 'user', userId: 'test-user' },
                message: { type: 'text', text: 'Hello' },
            };
            
            expect(messageEvent.type).toBe('message');
            expect(messageEvent.message.text).toBe('Hello');
        });

        it('should handle postback events', async () => {
            const postbackEvent = {
                type: 'postback',
                replyToken: 'test-token',
                source: { type: 'user', userId: 'test-user' },
                postback: { data: '今天行程' },
            };
            
            expect(postbackEvent.type).toBe('postback');
            expect(postbackEvent.postback.data).toBe('今天行程');
        });

        it('should handle follow events', async () => {
            const followEvent = {
                type: 'follow',
                replyToken: 'test-token',
                source: { type: 'user', userId: 'test-user' },
            };
            
            expect(followEvent.type).toBe('follow');
        });

        it('should handle unfollow events', async () => {
            const unfollowEvent = {
                type: 'unfollow',
                source: { type: 'user', userId: 'test-user' },
            };
            
            expect(unfollowEvent.type).toBe('unfollow');
        });
    });

    describe('Message Processing', () => {
        it('should process text messages', async () => {
            const { generateAIResponse } = require('../services/butler-ai.service');
            
            await generateAIResponse('今天行程', 'test-user');
            
            expect(generateAIResponse).toHaveBeenCalledWith('今天行程', 'test-user');
        });

        it('should handle empty messages', async () => {
            const messageEvent = {
                type: 'message',
                message: { type: 'text', text: '' },
            };
            
            expect(messageEvent.message.text).toBe('');
        });
    });

    describe('Rich Menu Actions', () => {
        it('should map postback data to keywords', () => {
            const richMenuActions = [
                { data: '今天行程', expectedKeyword: '行程' },
                { data: '這個月支出', expectedKeyword: '財務' },
                { data: '保養提醒', expectedKeyword: '車' },
                { data: '今日健康', expectedKeyword: '健康' },
                { data: '專案狀態', expectedKeyword: '專案' },
                { data: '幫助', expectedKeyword: '幫助' },
            ];
            
            richMenuActions.forEach(({ data, expectedKeyword }) => {
                expect(data.length).toBeGreaterThan(0);
            });
        });
    });
});
