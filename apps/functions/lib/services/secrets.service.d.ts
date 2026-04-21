/**
 * Domain-Specific Secret Accessors
 *
 * Thin wrappers around config/secrets.ts for LINE and Notion tokens.
 * Eliminates the duplicate SecretManagerServiceClient (#4).
 */
/** Get LINE channel secret */
export declare function getLineChannelSecret(integrationId: string): Promise<string>;
/** Get LINE channel access token */
export declare function getLineAccessToken(integrationId: string): Promise<string>;
/** Get Notion integration token */
export declare function getNotionToken(integrationId: string): Promise<string>;
/** Clear secret cache (useful for testing) */
export { getSecret } from '../config/secrets';
//# sourceMappingURL=secrets.service.d.ts.map