/**
 * Centralized Secret Configuration (#13)
 * 
 * Unified secret management that abstracts Secret Manager access.
 * All secrets are loaded lazily and cached for the function lifetime.
 */
import { logger } from 'firebase-functions/v2';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let client: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient {
    if (!client) {
        client = new SecretManagerServiceClient();
    }
    return client;
}

const secretCache = new Map<string, string>();

/**
 * Get a secret value. Priority:
 * 1. In-memory cache
 * 2. Environment variable (for local dev)
 * 3. Google Secret Manager
 */
export async function getSecret(name: string): Promise<string> {
    // Check cache
    const cached = secretCache.get(name);
    if (cached) return cached;
    
    // Check environment variable (local dev)
    const envValue = process.env[name];
    if (envValue) {
        secretCache.set(name, envValue);
        return envValue;
    }
    
    // Load from Secret Manager
    try {
        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'xxt-agent';
        const [version] = await getClient().accessSecretVersion({
            name: `projects/${projectId}/secrets/${name}/versions/latest`,
        });
        const value = version.payload?.data?.toString() || '';
        secretCache.set(name, value);
        logger.info(`[Secrets] Loaded "${name}" from Secret Manager`);
        return value;
    } catch (error) {
        logger.error(`[Secrets] Failed to load "${name}":`, error);
        throw new Error(`Secret "${name}" not available`);
    }
}

/**
 * Get a secret value, returning null if not available (non-critical).
 */
export async function getOptionalSecret(name: string): Promise<string | null> {
    try {
        return await getSecret(name);
    } catch {
        return null;
    }
}

/**
 * Preload multiple secrets into cache for faster access.
 */
export async function preloadSecrets(names: string[]): Promise<void> {
    await Promise.allSettled(names.map(name => getSecret(name)));
}

/**
 * Clear the secret cache (useful for testing).
 */
export function clearSecretCache(): void {
    secretCache.clear();
}

// Known secret names (for documentation and type safety)
export const SecretNames = {
    TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
    LINE_CHANNEL_SECRET: 'LINE_CHANNEL_SECRET',
    LINE_CHANNEL_ACCESS_TOKEN: 'LINE_CHANNEL_ACCESS_TOKEN',
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    OPENAI_API_KEY: 'OPENAI_API_KEY',
    INTERNAL_API_KEY: 'INTERNAL_API_KEY',
    NOTION_API_KEY: 'NOTION_API_KEY',
} as const;
