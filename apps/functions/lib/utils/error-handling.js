"use strict";
/**
 * Error Handling Utilities
 * Provides type-safe error handling for unknown catch types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractErrorInfo = extractErrorInfo;
exports.isRetryableError = isRetryableError;
exports.getErrorMessage = getErrorMessage;
/**
 * Extract error information from unknown error type
 */
function extractErrorInfo(error) {
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: error.code,
        };
    }
    if (typeof error === 'object' && error !== null) {
        const errObj = error;
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
function isRetryableError(error) {
    const info = extractErrorInfo(error);
    if (!info.code)
        return false;
    return info.code === 429 || info.code >= 500;
}
/**
 * Get a safe error message (for logging or API responses)
 */
function getErrorMessage(error) {
    return extractErrorInfo(error).message;
}
//# sourceMappingURL=error-handling.js.map