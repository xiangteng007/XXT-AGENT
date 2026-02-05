/**
 * Social Dispatcher Service
 *
 * Triggered by Cloud Scheduler every minute.
 * Reads enabled social_sources and fans out Cloud Tasks for each source.
 */
/**
 * Main dispatcher function
 */
export declare function dispatchSocialCollectJobs(): Promise<{
    dispatched: number;
    skipped: number;
    errors: string[];
}>;
/**
 * Get all tenant IDs that have social sources
 */
export declare function getTenantsWithSources(): Promise<string[]>;
//# sourceMappingURL=social-dispatcher.service.d.ts.map