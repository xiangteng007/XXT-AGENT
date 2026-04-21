"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretNames = void 0;
exports.getSecret = getSecret;
exports.getOptionalSecret = getOptionalSecret;
exports.preloadSecrets = preloadSecrets;
exports.clearSecretCache = clearSecretCache;
/**
 * Centralized Secret Configuration (#13)
 *
 * Unified secret management that abstracts Secret Manager access.
 * All secrets are loaded lazily and cached for the function lifetime.
 */
const v2_1 = require("firebase-functions/v2");
const secret_manager_1 = require("@google-cloud/secret-manager");
let client = null;
function getClient() {
    if (!client) {
        client = new secret_manager_1.SecretManagerServiceClient();
    }
    return client;
}
const secretCache = new Map();
/**
 * Get a secret value. Priority:
 * 1. In-memory cache
 * 2. Environment variable (for local dev)
 * 3. Google Secret Manager
 */
async function getSecret(name) {
    // Check cache
    const cached = secretCache.get(name);
    if (cached)
        return cached;
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
        v2_1.logger.info(`[Secrets] Loaded "${name}" from Secret Manager`);
        return value;
    }
    catch (error) {
        v2_1.logger.error(`[Secrets] Failed to load "${name}":`, error);
        throw new Error(`Secret "${name}" not available`);
    }
}
/**
 * Get a secret value, returning null if not available (non-critical).
 */
async function getOptionalSecret(name) {
    try {
        return await getSecret(name);
    }
    catch {
        return null;
    }
}
/**
 * Preload multiple secrets into cache for faster access.
 */
async function preloadSecrets(names) {
    await Promise.allSettled(names.map(name => getSecret(name)));
}
/**
 * Clear the secret cache (useful for testing).
 */
function clearSecretCache() {
    secretCache.clear();
}
// Known secret names (for documentation and type safety)
exports.SecretNames = {
    TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
    LINE_CHANNEL_SECRET: 'LINE_CHANNEL_SECRET',
    LINE_CHANNEL_ACCESS_TOKEN: 'LINE_CHANNEL_ACCESS_TOKEN',
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    OPENAI_API_KEY: 'OPENAI_API_KEY',
    INTERNAL_API_KEY: 'INTERNAL_API_KEY',
    NOTION_API_KEY: 'NOTION_API_KEY',
};
//# sourceMappingURL=secrets.js.map