interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs?: number;
    shouldRetry: (error: unknown) => boolean;
}
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>;
/**
 * Sleep for a given number of milliseconds
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Check if error is retryable (429 or 5xx)
 */
export declare function isRetryableError(error: unknown): boolean;
export {};
//# sourceMappingURL=retry.d.ts.map