/**
 * Clean up old completed/ignored jobs
 */
export declare function cleanupOldJobs(): Promise<{
    deleted: number;
    errors: number;
}>;
/**
 * Clean up old logs
 */
export declare function cleanupOldLogs(): Promise<{
    deleted: number;
    errors: number;
}>;
/**
 * Clean up old processed events (deduplication records)
 */
export declare function cleanupProcessedEvents(): Promise<{
    deleted: number;
    errors: number;
}>;
/**
 * Clean up old images in Cloud Storage
 */
export declare function cleanupOldImages(tenantIds: string[]): Promise<{
    totalDeleted: number;
}>;
/**
 * Get all tenant IDs for cleanup
 */
export declare function getAllTenantIds(): Promise<string[]>;
/**
 * Run all cleanup tasks
 */
export declare function runAllCleanup(): Promise<{
    jobs: {
        deleted: number;
        errors: number;
    };
    logs: {
        deleted: number;
        errors: number;
    };
    events: {
        deleted: number;
        errors: number;
    };
    images: {
        totalDeleted: number;
    };
}>;
//# sourceMappingURL=cleanup.service.d.ts.map