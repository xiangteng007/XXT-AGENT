"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignature = verifySignature;
exports.replyMessage = replyMessage;
exports.getUserProfile = getUserProfile;
exports.getMessageContent = getMessageContent;
const secrets_service_1 = require("./secrets.service");
const validation_1 = require("../utils/validation");
const LINE_API_BASE = 'https://api.line.me/v2/bot';
/**
 * Verify LINE webhook signature
 */
function verifySignature(body, signature, channelSecret) {
    return (0, validation_1.verifyLineSignature)(body, signature, channelSecret);
}
/**
 * Send reply message to LINE
 */
async function replyMessage(replyToken, integrationId, messages) {
    try {
        const accessToken = await (0, secrets_service_1.getLineAccessToken)(integrationId);
        const messageArray = typeof messages === 'string'
            ? [{ type: 'text', text: messages }]
            : messages;
        const payload = {
            replyToken,
            messages: messageArray,
        };
        const response = await fetch(`${LINE_API_BASE}/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('LINE reply failed:', response.status, errorBody);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('LINE reply error:', error);
        return false;
    }
}
/**
 * Get user profile from LINE
 */
async function getUserProfile(userId, integrationId) {
    try {
        const accessToken = await (0, secrets_service_1.getLineAccessToken)(integrationId);
        const response = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return {
            displayName: data.displayName,
            pictureUrl: data.pictureUrl,
        };
    }
    catch (error) {
        console.error('Get profile error:', error);
        return null;
    }
}
/**
 * Get binary content (image/video) from LINE
 */
async function getMessageContent(messageId, integrationId) {
    try {
        const accessToken = await (0, secrets_service_1.getLineAccessToken)(integrationId);
        const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    catch (error) {
        console.error('Get content error:', error);
        return null;
    }
}
//# sourceMappingURL=line.service.js.map