"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessSecret = accessSecret;
const secret_manager_1 = require("@google-cloud/secret-manager");
async function accessSecret(projectId, secretId) {
    const client = new secret_manager_1.SecretManagerServiceClient();
    const name = `projects/${projectId}/secrets/${secretId}/versions/latest`;
    const [resp] = await client.accessSecretVersion({ name });
    const data = resp.payload?.data;
    if (!data)
        return "";
    if (typeof data === "string")
        return data;
    return new TextDecoder("utf-8").decode(data);
}
