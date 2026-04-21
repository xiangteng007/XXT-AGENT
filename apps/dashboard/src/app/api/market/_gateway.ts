/**
 * Shared utilities for market API routes.
 * Proxies requests to the OpenClaw Gateway investment endpoints.
 */

/** Server-only gateway URL (never exposed to client) */
export const GATEWAY_URL =
    process.env.OPENCLAW_GATEWAY_URL ?? 'http://localhost:3100';

/** Default timeout for gateway fetch calls */
export const GATEWAY_TIMEOUT_MS = 15_000;

/**
 * Fetch from the OpenClaw Gateway with error handling.
 * Runs on the server inside Next.js route handlers only.
 */
export async function gatewayFetch(
    path: string,
    init?: RequestInit,
): Promise<Response> {
    const url = `${GATEWAY_URL}${path}`;
    return fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
        headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
}
