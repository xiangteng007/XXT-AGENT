/**
 * Main LINE webhook handler (Refactored for Queue Architecture)
 *
 * Changes from original:
 * 1. Uses actual rawBody (not JSON.stringify)
 * 2. Enqueues jobs instead of direct Notion writes
 * 3. Fast ACK (< 3 seconds target)
 * 4. Deduplication via processedEvents
 */
import { Request, Response } from 'express';
/**
 * Main LINE webhook handler
 */
export declare function handleWebhook(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=webhook.handler.v2.d.ts.map