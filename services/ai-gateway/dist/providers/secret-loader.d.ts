/**
 * Secret Loader
 *
 * Loads secrets from environment variables or GCP Secret Manager.
 */
/**
 * Load a secret from environment variable or Secret Manager.
 * Environment variable takes precedence.
 */
export declare function loadSecret(envKey: string, secretId?: string): Promise<string | null>;
