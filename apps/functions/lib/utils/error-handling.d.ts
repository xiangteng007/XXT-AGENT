/**
 * Error Handling Utilities
 * Provides type-safe error handling for unknown catch types
 */
export interface ErrorInfo {
    message: string;
    code?: number;
    name?: string;
    stack?: string;
}
/**
 * Extract error information from unknown error type
 */
export declare function extractErrorInfo(error: unknown): ErrorInfo;
/**
 * Check if an error is retryable based on its code
 */
export declare function isRetryableError(error: unknown): boolean;
/**
 * Get a safe error message (for logging or API responses)
 */
export declare function getErrorMessage(error: unknown): string;
//# sourceMappingURL=error-handling.d.ts.map