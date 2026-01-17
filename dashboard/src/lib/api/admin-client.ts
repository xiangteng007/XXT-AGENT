// Admin API client for centralized admin operations

import { ENDPOINTS } from './endpoints';

interface AdminRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    params?: Record<string, string>;
}

/**
 * Admin API client - requires authentication token
 */
export class AdminClient {
    private baseUrl: string;
    private getToken: () => Promise<string>;

    constructor(baseUrl: string, getToken: () => Promise<string>) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }

    private async request<T>(endpoint: string, options: AdminRequestOptions = {}): Promise<T> {
        const { method = 'GET', body, params } = options;
        const token = await this.getToken();

        let url = `${this.baseUrl}${endpoint}`;
        if (params) {
            const searchParams = new URLSearchParams(params);
            url += `?${searchParams}`;
        }

        const headers: HeadersInit = {
            Authorization: `Bearer ${token}`,
        };

        if (body) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Request failed: ${response.status}`);
        }

        return response.json();
    }

    // Tenant operations
    async getTenants() {
        return this.request<{ tenants: unknown[] }>(ENDPOINTS.ADMIN_TENANTS);
    }

    async createTenant(data: unknown) {
        return this.request(ENDPOINTS.ADMIN_TENANTS, { method: 'POST', body: data });
    }

    async deleteTenant(id: string) {
        return this.request(`${ENDPOINTS.ADMIN_TENANTS}/${id}`, { method: 'DELETE' });
    }

    // Job operations
    async getJobs(params?: { status?: string; limit?: number }) {
        const queryParams: Record<string, string> = {};
        if (params?.status) queryParams.status = params.status;
        if (params?.limit) queryParams.limit = params.limit.toString();
        return this.request<{ jobs: unknown[] }>(ENDPOINTS.ADMIN_JOBS, { params: queryParams });
    }

    async requeueJob(jobId: string) {
        return this.request(`${ENDPOINTS.ADMIN_JOBS}/${jobId}/requeue`, { method: 'POST' });
    }

    async ignoreJob(jobId: string) {
        return this.request(`${ENDPOINTS.ADMIN_JOBS}/${jobId}/ignore`, { method: 'POST' });
    }

    // Rule operations
    async getRules(tenantId: string) {
        return this.request<{ rules: unknown[] }>(ENDPOINTS.ADMIN_RULES, {
            params: { tenantId }
        });
    }

    async createRule(data: unknown) {
        return this.request(ENDPOINTS.ADMIN_RULES, { method: 'POST', body: data });
    }

    async deleteRule(ruleId: string, tenantId: string) {
        return this.request(`${ENDPOINTS.ADMIN_RULES}/${ruleId}`, {
            method: 'DELETE',
            params: { tenantId }
        });
    }

    async testRule(tenantId: string, text: string) {
        return this.request(`${ENDPOINTS.ADMIN_RULES}/test`, {
            method: 'POST',
            body: { tenantId, text }
        });
    }

    // Mapping operations
    async getMappings(tenantId: string) {
        return this.request<{ mappings: unknown[] }>(ENDPOINTS.ADMIN_MAPPINGS, {
            params: { tenantId }
        });
    }

    async createMapping(data: unknown) {
        return this.request(ENDPOINTS.ADMIN_MAPPINGS, { method: 'POST', body: data });
    }

    async deleteMapping(mappingId: string, tenantId: string) {
        return this.request(`${ENDPOINTS.ADMIN_MAPPINGS}/${mappingId}`, {
            method: 'DELETE',
            params: { tenantId }
        });
    }

    // Log operations
    async getLogs(params?: { type?: string; limit?: number }) {
        const queryParams: Record<string, string> = {};
        if (params?.type) queryParams.type = params.type;
        if (params?.limit) queryParams.limit = params.limit.toString();
        return this.request<{ logs: unknown[] }>(ENDPOINTS.ADMIN_LOGS, { params: queryParams });
    }

    // Stats operations
    async getStats() {
        return this.request<{ stats: unknown }>(ENDPOINTS.ADMIN_STATS);
    }
}

/**
 * Create an admin client instance
 */
export function createAdminClient(getToken: () => Promise<string>, baseUrl = '') {
    return new AdminClient(baseUrl, getToken);
}
