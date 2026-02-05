"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
exports.getLineChannelSecret = getLineChannelSecret;
exports.getLineAccessToken = getLineAccessToken;
exports.getNotionToken = getNotionToken;
exports.clearSecretCache = clearSecretCache;
const secret_manager_1 = require("@google-cloud/secret-manager");
const client = new secret_manager_1.SecretManagerServiceClient();
// Get project ID from environment
const getProjectId = () => {
    return process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        '';
};
// In-memory cache for secrets
const secretCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
/**
 * Get secret from Secret Manager with caching
 */
async function getSecret(secretName) {
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
    }
    catch (error) {
        const err = error;
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
async function getLineChannelSecret(integrationId) {
    return getSecret(`line-channel-secret-${integrationId}`);
}
/**
 * Get LINE channel access token
 */
async function getLineAccessToken(integrationId) {
    return getSecret(`line-access-token-${integrationId}`);
}
/**
 * Get Notion integration token
 */
async function getNotionToken(integrationId) {
    return getSecret(`notion-token-${integrationId}`);
}
/**
 * Clear secret cache (useful for testing)
 */
function clearSecretCache() {
    secretCache.clear();
}
//# sourceMappingURL=secrets.service.js.map