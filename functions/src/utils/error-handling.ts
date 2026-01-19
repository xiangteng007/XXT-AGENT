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
export function extractErrorInfo(error: unknown): ErrorInfo {
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: (error as { code?: number }).code,
        };
    }

    if (typeof error === 'object' && error !== null) {
        const errObj = error as Record<string, unknown>;
        return {
            message: String(errObj.message || errObj.error || 'Unknown error'),
            code: typeof errObj.code === 'number' ? errObj.code : undefined,
            name: typeof errObj.name === 'string' ? errObj.name : undefined,
        };
    }

    return {
        message: String(error),
    };
}

/**
 * Check if an error is retryable based on its code
 */
export function isRetryableError(error: unknown): boolean {
    const info = extractErrorInfo(error);
    if (!info.code) return false;
    return info.code === 429 || info.code >= 500;
}

/**
 * Get a safe error message (for logging or API responses)
 */
export function getErrorMessage(error: unknown): string {
    return extractErrorInfo(error).message;
}
