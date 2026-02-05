import { Job, JobPayload, JobStatus } from '../models/job.model';
/**
 * Enqueue a new job
 */
export declare function enqueueJob(payload: JobPayload, webhookEventId: string): Promise<string>;
/**
 * Fetch queued jobs for processing
 */
export declare function fetchQueuedJobs(limit?: number): Promise<Job[]>;
/**
 * Claim a job for processing (atomic update)
 */
export declare function claimJob(jobId: string): Promise<boolean>;
/**
 * Mark job as completed
 */
export declare function completeJob(jobId: string): Promise<void>;
/**
 * Mark job as failed (may retry or dead)
 */
export declare function failJob(jobId: string, error: Error): Promise<void>;
/**
 * Check if event already processed (deduplication)
 */
export declare function isEventProcessed(webhookEventId: string): Promise<boolean>;
/**
 * Mark event as processed (deduplication)
 */
export declare function markEventProcessed(webhookEventId: string, tenantId: string): Promise<void>;
/**
 * Get job by ID
 */
export declare function getJob(jobId: string): Promise<Job | null>;
/**
 * Update job status (for dashboard requeue/ignore)
 */
export declare function updateJobStatus(jobId: string, status: JobStatus, actorUid?: string): Promise<void>;
//# sourceMappingURL=queue.service.d.ts.map