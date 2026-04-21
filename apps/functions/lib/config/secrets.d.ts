/**
 * Get a secret value. Priority:
 * 1. In-memory cache
 * 2. Environment variable (for local dev)
 * 3. Google Secret Manager
 */
export declare function getSecret(name: string): Promise<string>;
/**
 * Get a secret value, returning null if not available (non-critical).
 */
export declare function getOptionalSecret(name: string): Promise<string | null>;
/**
 * Preload multiple secrets into cache for faster access.
 */
export declare function preloadSecrets(names: string[]): Promise<void>;
/**
 * Clear the secret cache (useful for testing).
 */
export declare function clearSecretCache(): void;
export declare const SecretNames: {
    readonly TELEGRAM_BOT_TOKEN: "TELEGRAM_BOT_TOKEN";
    readonly LINE_CHANNEL_SECRET: "LINE_CHANNEL_SECRET";
    readonly LINE_CHANNEL_ACCESS_TOKEN: "LINE_CHANNEL_ACCESS_TOKEN";
    readonly GEMINI_API_KEY: "GEMINI_API_KEY";
    readonly OPENAI_API_KEY: "OPENAI_API_KEY";
    readonly INTERNAL_API_KEY: "INTERNAL_API_KEY";
    readonly NOTION_API_KEY: "NOTION_API_KEY";
};
//# sourceMappingURL=secrets.d.ts.map