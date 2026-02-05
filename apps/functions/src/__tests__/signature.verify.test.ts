/**
 * LINE Signature Verification Tests
 */
import { describe, it, expect } from '@jest/globals';
import * as crypto from 'crypto';

// Inline signature verification for testing
function verifySignature(body: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}

describe('LINE Signature Verification', () => {
    const channelSecret = 'test-channel-secret';

    function generateValidSignature(body: string, secret: string): string {
        return crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('base64');
    }

    describe('verifySignature', () => {
        it('should return true for valid signature', () => {
            const body = JSON.stringify({ events: [] });
            const signature = generateValidSignature(body, channelSecret);

            const result = verifySignature(body, signature, channelSecret);
            expect(result).toBe(true);
        });

        it('should return false for invalid signature', () => {
            const body = JSON.stringify({ events: [] });
            const validSig = generateValidSignature(body, channelSecret);
            // Create invalid signature by modifying
            const invalidSignature = validSig.slice(0, -2) + 'XX';

            const result = verifySignature(body, invalidSignature, channelSecret);
            expect(result).toBe(false);
        });

        it('should return false for tampered body', () => {
            const originalBody = JSON.stringify({ events: [] });
            const tamperedBody = JSON.stringify({ events: [{ type: 'hack' }] });
            const signature = generateValidSignature(originalBody, channelSecret);

            const result = verifySignature(tamperedBody, signature, channelSecret);
            expect(result).toBe(false);
        });

        it('should handle empty body', () => {
            const body = '';
            const signature = generateValidSignature(body, channelSecret);

            const result = verifySignature(body, signature, channelSecret);
            expect(result).toBe(true);
        });

        it('should reject completely wrong signature', () => {
            const body = JSON.stringify({ events: [] });
            const wrongSignature = 'completely-wrong-signature';

            const result = verifySignature(body, wrongSignature, channelSecret);
            expect(result).toBe(false);
        });
    });
});
