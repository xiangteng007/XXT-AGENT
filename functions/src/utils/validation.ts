import * as crypto from 'crypto';

/**
 * Verify LINE webhook signature
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#verifying-signatures
 */
export function verifyLineSignature(
    body: string,
    signature: string,
    channelSecret: string
): boolean {
    try {
        const hash = crypto
            .createHmac('sha256', channelSecret)
            .update(body)
            .digest('base64');

        // Use timing-safe comparison to prevent timing attacks
        return crypto.timingSafeEqual(
            Buffer.from(hash),
            Buffer.from(signature)
        );
    } catch {
        return false;
    }
}

/**
 * Validate required fields in webhook payload
 */
export function validateWebhookPayload(body: unknown): {
    valid: boolean;
    error?: string;
    destination?: string;
    events?: unknown[];
} {
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Invalid body' };
    }

    const payload = body as Record<string, unknown>;

    if (!payload.destination || typeof payload.destination !== 'string') {
        return { valid: false, error: 'Missing destination' };
    }

    if (!Array.isArray(payload.events)) {
        return { valid: false, error: 'Missing or invalid events' };
    }

    return {
        valid: true,
        destination: payload.destination,
        events: payload.events,
    };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength = 1000): string {
    if (typeof input !== 'string') {
        return '';
    }

    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
}

/**
 * Validate Notion database ID format
 */
export function isValidNotionDatabaseId(id: string): boolean {
    // Notion IDs are 32 character hex strings (with or without dashes)
    const cleanId = id.replace(/-/g, '');
    return /^[a-f0-9]{32}$/i.test(cleanId);
}
