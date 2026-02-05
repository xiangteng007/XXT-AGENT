interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs?: number;
    shouldRetry: (error: unknown) => boolean;
}

interface RetryableError {
    status?: number;
    code?: string;
    headers?: Record<string, string>;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions
): Promise<T> {
    const { maxRetries, baseDelayMs, maxDelayMs = 30000, shouldRetry } = options;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error;

            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }

            // Calculate delay with exponential backoff + jitter
            let delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;

            // Special handling for 429 rate limit
            const retryableError = error as RetryableError;
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
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (429 or 5xx)
 */
export function isRetryableError(error: unknown): boolean {
    const retryableError = error as RetryableError;
    const status = retryableError?.status;

    if (!status) {
        // Network errors are retryable
        const code = retryableError?.code;
        return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
    }

    // Retry on rate limit or server errors
    return status === 429 || (status >= 500 && status < 600);
}
