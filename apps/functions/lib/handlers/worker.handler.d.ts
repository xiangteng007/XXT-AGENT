/**
 * Worker Handler - Processes jobs from the queue (v2 with image/location support)
 *
 * Triggered by: Cloud Scheduler (every minute) or HTTP
 */
import { Request, Response } from 'express';
/**
 * Main worker entry point
 */
export declare function handleWorker(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=worker.handler.d.ts.map