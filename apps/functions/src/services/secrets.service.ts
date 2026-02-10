/**
 * Domain-Specific Secret Accessors
 * 
 * Thin wrappers around config/secrets.ts for LINE and Notion tokens.
 * Eliminates the duplicate SecretManagerServiceClient (#4).
 */

import { getSecret } from '../config/secrets';

/** Get LINE channel secret */
export async function getLineChannelSecret(integrationId: string): Promise<string> {
    return getSecret(`line-channel-secret-${integrationId}`);
}

/** Get LINE channel access token */
export async function getLineAccessToken(integrationId: string): Promise<string> {
    return getSecret(`line-access-token-${integrationId}`);
}

/** Get Notion integration token */
export async function getNotionToken(integrationId: string): Promise<string> {
    return getSecret(`notion-token-${integrationId}`);
}

/** Clear secret cache (useful for testing) */
export { getSecret } from '../config/secrets';
