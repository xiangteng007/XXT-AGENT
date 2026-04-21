export interface FetchWithRetryOptions extends RequestInit {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
    timeoutMs?: number;
}

export class FetchError extends Error {
    constructor(
        public status: number,
        public statusText: string,
        public body: string,
        message: string
    ) {
        super(message);
        this.name = 'FetchError';
    }
}

export async function fetchWithRetry(url: string, options: FetchWithRetryOptions = {}): Promise<Response> {
    const {
        maxRetries = 3,
        initialDelayMs = 1000,
        backoffFactor = 2,
        timeoutMs = 15000,
        ...fetchOptions
    } = options;

    let lastError: Error | undefined;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal as AbortSignal,
            });
            
            clearTimeout(id);

            // If success (2xx), return response
            if (response.ok) {
                return response;
            }

            // Client errors (4xx) generally shouldn't be retried unless it's 429 Too Many Requests
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                const body = await response.text().catch(() => '');
                throw new FetchError(
                    response.status,
                    response.statusText,
                    body,
                    `HTTP Error ${response.status}: ${response.statusText}`
                );
            }

            // Server errors (5xx) or 429 can be retried
            const body = await response.text().catch(() => '');
            lastError = new FetchError(
                response.status,
                response.statusText,
                body,
                `HTTP Error ${response.status}: ${response.statusText} (Attempt ${attempt + 1}/${maxRetries + 1})`
            );
        } catch (error: any) {
            // AbortError is from timeout
            if (error.name === 'AbortError') {
                lastError = new Error(`Request timed out after ${timeoutMs}ms (Attempt ${attempt + 1}/${maxRetries + 1})`);
            } else if (error instanceof FetchError && error.status >= 400 && error.status < 500 && error.status !== 429) {
                // Throw immediately for 4xx (except 429)
                throw error;
            } else {
                lastError = error instanceof Error ? error : new Error(String(error));
            }
        }

        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
            console.warn(`[fetchWithRetry] Request failed: ${lastError.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= backoffFactor;
        }
    }

    throw lastError || new Error('Request failed after maximum retries');
}
