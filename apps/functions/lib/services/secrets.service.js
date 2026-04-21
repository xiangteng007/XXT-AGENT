"use strict";
/**
 * Domain-Specific Secret Accessors
 *
 * Thin wrappers around config/secrets.ts for LINE and Notion tokens.
 * Eliminates the duplicate SecretManagerServiceClient (#4).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = void 0;
exports.getLineChannelSecret = getLineChannelSecret;
exports.getLineAccessToken = getLineAccessToken;
exports.getNotionToken = getNotionToken;
const secrets_1 = require("../config/secrets");
/** Get LINE channel secret */
async function getLineChannelSecret(integrationId) {
    return (0, secrets_1.getSecret)(`line-channel-secret-${integrationId}`);
}
/** Get LINE channel access token */
async function getLineAccessToken(integrationId) {
    return (0, secrets_1.getSecret)(`line-access-token-${integrationId}`);
}
/** Get Notion integration token */
async function getNotionToken(integrationId) {
    return (0, secrets_1.getSecret)(`notion-token-${integrationId}`);
}
/** Clear secret cache (useful for testing) */
var secrets_2 = require("../config/secrets");
Object.defineProperty(exports, "getSecret", { enumerable: true, get: function () { return secrets_2.getSecret; } });
//# sourceMappingURL=secrets.service.js.map