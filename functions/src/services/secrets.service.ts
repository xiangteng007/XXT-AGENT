import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

// Get project ID from environment
const getProjectId = (): string => {
    return process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        '';
};

// In-memory cache for secrets
const secretCache = new Map<string, { value: string; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get secret from Secret Manager with caching
 */
export async function getSecret(secretName: string): Promise<string> {
    // Check cache first
    const cached = secretCache.get(secretName);
    if (cached && cached.expiry > Date.now()) {
        return cached.value;
    }

    const projectId = getProjectId();
    if (!projectId) {
        throw new Error('Project ID not configured');
    }

    try {
        const [version] = await client.accessSecretVersion({
            name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
        });

        const value = version.payload?.data?.toString() || '';

        // Update cache
        secretCache.set(secretName, {
            value,
            expiry: Date.now() + CACHE_TTL,
        });

        return value;

    } catch (error: unknown) {
        const err = error as Error & { code?: number };
        console.error(`Failed to get secret ${secretName}:`, err.message);

        // Return cached value if available (even if expired)
        if (cached) {
            console.warn(`Using expired cache for ${secretName}`);
            return cached.value;
        }

        throw error;
    }
}

/**
 * Get LINE channel secret
 */
export async function getLineChannelSecret(integrationId: string): Promise<string> {
    return getSecret(`line-channel-secret-${integrationId}`);
}

/**
 * Get LINE channel access token
 */
export async function getLineAccessToken(integrationId: string): Promise<string> {
    return getSecret(`line-access-token-${integrationId}`);
}

/**
 * Get Notion integration token
 */
export async function getNotionToken(integrationId: string): Promise<string> {
    return getSecret(`notion-token-${integrationId}`);
}

/**
 * Clear secret cache (useful for testing)
 */
export function clearSecretCache(): void {
    secretCache.clear();
}
