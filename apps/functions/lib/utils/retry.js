"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = retry;
exports.sleep = sleep;
exports.isRetryableError = isRetryableError;
/**
 * Retry a function with exponential backoff
 */
async function retry(fn, options) {
    const { maxRetries, baseDelayMs, maxDelayMs = 30000, shouldRetry } = options;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }
            // Calculate delay with exponential backoff + jitter
            let delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
            // Special handling for 429 rate limit
            const retryableError = error;
            if (retryableError?.status === 429 && retryableError?.headers?.['retry-after']) {
                const retryAfter = parseInt(retryableError.headers['retry-after'], 10) * 1000;
                delay = Math.max(delay, retryAfter);
            }
            // Cap the delay
            delay = Math.min(delay, maxDelayMs);
            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
            await sleep(delay);
        }
    }
    throw lastError;
}
/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Check if error is retryable (429 or 5xx)
 */
function isRetryableError(error) {
    const retryableError = error;
    const status = retryableError?.status;
    if (!status) {
        // Network errors are retryable
        const code = retryableError?.code;
        return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
    }
    // Retry on rate limit or server errors
    return status === 429 || (status >= 500 && status < 600);
}
//# sourceMappingURL=retry.js.map