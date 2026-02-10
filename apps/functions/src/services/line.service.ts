import { logger } from 'firebase-functions/v2';
import { getLineAccessToken } from './secrets.service';
import { verifyLineSignature } from '../utils/validation';
import { LineReplyMessage, LineTextSendMessage } from '../types';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

/**
 * Verify LINE webhook signature
 */
export function verifySignature(
    body: string,
    signature: string,
    channelSecret: string
): boolean {
    return verifyLineSignature(body, signature, channelSecret);
}

/**
 * Send reply message to LINE
 */
export async function replyMessage(
    replyToken: string,
    integrationId: string,
    messages: string | LineTextSendMessage[]
): Promise<boolean> {
    try {
        const accessToken = await getLineAccessToken(integrationId);

        const messageArray: LineTextSendMessage[] = typeof messages === 'string'
            ? [{ type: 'text', text: messages }]
            : messages;

        const payload: LineReplyMessage = {
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
            logger.error('LINE reply failed:', response.status, errorBody);
            return false;
        }

        return true;

    } catch (error) {
        logger.error('LINE reply error:', error);
        return false;
    }
}

/**
 * Get user profile from LINE
 */
export async function getUserProfile(
    userId: string,
    integrationId: string
): Promise<{ displayName: string; pictureUrl?: string } | null> {
    try {
        const accessToken = await getLineAccessToken(integrationId);

        const response = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json() as { displayName: string; pictureUrl?: string };
        return {
            displayName: data.displayName,
            pictureUrl: data.pictureUrl,
        };

    } catch (error) {
        logger.error('Get profile error:', error);
        return null;
    }
}

/**
 * Get binary content (image/video) from LINE
 */
export async function getMessageContent(
    messageId: string,
    integrationId: string
): Promise<Buffer | null> {
    try {
        const accessToken = await getLineAccessToken(integrationId);

        const response = await fetch(
            `https://api-data.line.me/v2/bot/message/${messageId}/content`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);

    } catch (error) {
        logger.error('Get content error:', error);
        return null;
    }
}
