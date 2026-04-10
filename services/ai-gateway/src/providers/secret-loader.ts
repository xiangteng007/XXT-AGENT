/**
 * Secret Loader
 *
 * Loads secrets from environment variables or GCP Secret Manager.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { PROJECT_ID } from '../config';

/**
 * Load a secret from environment variable or Secret Manager.
 * Environment variable takes precedence.
 */
export async function loadSecret(envKey: string, secretId?: string): Promise<string | null> {
    if (process.env[envKey]) {
        return process.env[envKey]!;
    }

    if (!secretId) return null;

    try {
        const client = new SecretManagerServiceClient();
        const name = `projects/${PROJECT_ID}/secrets/${secretId}/versions/latest`;
        const [response] = await client.accessSecretVersion({ name });
        const payload = response.payload?.data;
        if (!payload) return null;
        return typeof payload === 'string' ? payload : new TextDecoder('utf-8').decode(payload as Uint8Array);
    } catch (error) {
        console.log(JSON.stringify({
            severity: 'WARNING',
            message: `Secret ${secretId} not available`,
            error: String(error),
        }));
        return null;
    }
}
