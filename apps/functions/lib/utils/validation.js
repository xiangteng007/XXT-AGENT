"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLineSignature = verifyLineSignature;
exports.validateWebhookPayload = validateWebhookPayload;
exports.sanitizeString = sanitizeString;
exports.isValidNotionDatabaseId = isValidNotionDatabaseId;
const crypto = __importStar(require("crypto"));
/**
 * Verify LINE webhook signature
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#verifying-signatures
 */
function verifyLineSignature(body, signature, channelSecret) {
    try {
        const hash = crypto
            .createHmac('sha256', channelSecret)
            .update(body)
            .digest('base64');
        // Use timing-safe comparison to prevent timing attacks
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    }
    catch {
        return false;
    }
}
/**
 * Validate required fields in webhook payload
 */
function validateWebhookPayload(body) {
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Invalid body' };
    }
    const payload = body;
    if (!payload.destination || typeof payload.destination !== 'string') {
        return { valid: false, error: 'Missing destination' };
    }
    if (!Array.isArray(payload.events)) {
        return { valid: false, error: 'Missing or invalid events' };
    }
    return {
        valid: true,
        destination: payload.destination,
        events: payload.events,
    };
}
/**
 * Sanitize string input
 */
function sanitizeString(input, maxLength = 1000) {
    if (typeof input !== 'string') {
        return '';
    }
    return input
        .trim()
        .slice(0, maxLength)
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
}
/**
 * Validate Notion database ID format
 */
function isValidNotionDatabaseId(id) {
    // Notion IDs are 32 character hex strings (with or without dashes)
    const cleanId = id.replace(/-/g, '');
    return /^[a-f0-9]{32}$/i.test(cleanId);
}
//# sourceMappingURL=validation.js.map