/**
 * Verify LINE webhook signature
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#verifying-signatures
 */
export declare function verifyLineSignature(body: string, signature: string, channelSecret: string): boolean;
/**
 * Validate required fields in webhook payload
 */
export declare function validateWebhookPayload(body: unknown): {
    valid: boolean;
    error?: string;
    destination?: string;
    events?: unknown[];
};
/**
 * Sanitize string input
 */
export declare function sanitizeString(input: string, maxLength?: number): string;
/**
 * Validate Notion database ID format
 */
export declare function isValidNotionDatabaseId(id: string): boolean;
//# sourceMappingURL=validation.d.ts.map