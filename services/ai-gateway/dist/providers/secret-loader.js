"use strict";
/**
 * Secret Loader
 *
 * Loads secrets from environment variables or GCP Secret Manager.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSecret = loadSecret;
const secret_manager_1 = require("@google-cloud/secret-manager");
const config_1 = require("../config");
/**
 * Load a secret from environment variable or Secret Manager.
 * Environment variable takes precedence.
 */
async function loadSecret(envKey, secretId) {
    if (process.env[envKey]) {
        return process.env[envKey];
    }
    if (!secretId)
        return null;
    try {
        const client = new secret_manager_1.SecretManagerServiceClient();
        const name = `projects/${config_1.PROJECT_ID}/secrets/${secretId}/versions/latest`;
        const [response] = await client.accessSecretVersion({ name });
        const payload = response.payload?.data;
        if (!payload)
            return null;
        return typeof payload === 'string' ? payload : new TextDecoder('utf-8').decode(payload);
    }
    catch (error) {
        console.log(JSON.stringify({
            severity: 'WARNING',
            message: `Secret ${secretId} not available`,
            error: String(error),
        }));
        return null;
    }
}
