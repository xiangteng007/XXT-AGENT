'use client';

import useSWR, { SWRConfiguration, SWRResponse } from 'swr';
import useSWRMutation, { SWRMutationConfiguration, SWRMutationResponse } from 'swr/mutation';
import { useAuth } from '@/lib/AuthContext';
import { ENDPOINTS } from '@/lib/api/endpoints';

// Default SWR config for the app
const defaultConfig: SWRConfiguration = {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    errorRetryCount: 3,
};

/**
 * Authenticated fetcher for SWR
 */
async function authFetcher(url: string, token: string | null): Promise<unknown> {
    if (!token) {
        throw new Error('No authentication token');
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = new Error('API request failed');
        (error as Error & { status?: number }).status = response.status;
        throw error;
    }

    return response.json();
}

/**
 * Hook for fetching admin data with SWR + authentication
 */
export function useAdminData<T = unknown>(
    endpoint: keyof typeof ENDPOINTS | string | null,
    params?: Record<string, string | number | undefined>,
    config?: SWRConfiguration
): SWRResponse<T, Error> & { isLoading: boolean } {
    const { getIdToken, user } = useAuth();

    // Build URL with params
    const url = endpoint ? buildUrl(
        typeof endpoint === 'string' && endpoint.startsWith('/')
            ? endpoint
            : ENDPOINTS[endpoint as keyof typeof ENDPOINTS] || endpoint,
        params
    ) : null;

    const result = useSWR<T, Error>(
        user && url ? [url, 'admin'] : null,
        async ([url]) => {
            const token = await getIdToken();
            return authFetcher(url, token) as Promise<T>;
        },
        { ...defaultConfig, ...config }
    );

    return {
        ...result,
        isLoading: result.isLoading || (!result.data && !result.error),
    };
}

/**
 * Hook for admin mutations (POST, PUT, DELETE)
 */
export function useAdminMutation<T = unknown, A = unknown>(
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE' = 'POST',
    config?: SWRMutationConfiguration<T, Error, string, A>
): SWRMutationResponse<T, Error, string, A> {
    const { getIdToken } = useAuth();

    return useSWRMutation<T, Error, string, A>(
        endpoint,
        async (url: string, { arg }: { arg: A }) => {
            const token = await getIdToken();

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: arg ? JSON.stringify(arg) : undefined,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `Request failed: ${response.status}`);
            }

            return response.json();
        },
        config
    );
}

/**
 * Specialized hooks for common admin operations
 */
export function useTenants() {
    return useAdminData<{ tenants: unknown[] }>('ADMIN_TENANTS');
}

export function useJobs(params?: { status?: string; limit?: number }) {
    return useAdminData<{ jobs: unknown[] }>('ADMIN_JOBS', params);
}

export function useRules(tenantId?: string) {
    return useAdminData<{ rules: unknown[] }>(
        tenantId ? 'ADMIN_RULES' : null,
        tenantId ? { tenantId } : undefined
    );
}

export function useMappings(tenantId?: string) {
    return useAdminData<{ mappings: unknown[] }>(
        tenantId ? 'ADMIN_MAPPINGS' : null,
        tenantId ? { tenantId } : undefined
    );
}

export function useLogs(params?: { type?: string; limit?: number }) {
    return useAdminData<{ logs: unknown[] }>('ADMIN_LOGS', params);
}

export function useStats() {
    return useAdminData<{ stats: unknown }>('ADMIN_STATS');
}

// Utility to build URL with params
function buildUrl(base: string, params?: Record<string, string | number | undefined>): string {
    if (!params) return base;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            searchParams.set(key, String(value));
        }
    });

    const queryString = searchParams.toString();
    return queryString ? `${base}?${queryString}` : base;
}
