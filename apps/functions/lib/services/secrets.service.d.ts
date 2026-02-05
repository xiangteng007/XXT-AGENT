/**
 * Get secret from Secret Manager with caching
 */
export declare function getSecret(secretName: string): Promise<string>;
/**
 * Get LINE channel secret
 */
export declare function getLineChannelSecret(integrationId: string): Promise<string>;
/**
 * Get LINE channel access token
 */
export declare function getLineAccessToken(integrationId: string): Promise<string>;
/**
 * Get Notion integration token
 */
export declare function getNotionToken(integrationId: string): Promise<string>;
/**
 * Clear secret cache (useful for testing)
 */
export declare function clearSecretCache(): void;
//# sourceMappingURL=secrets.service.d.ts.map