import { logger } from 'firebase-functions/v2';
import { Request, Response } from 'express';
import { getLineChannelSecret } from '../services/secrets.service';
import { verifySignature, replyMessage } from '../services/line.service';
import { findTenantByChannelId } from '../services/tenant.service';
import { processMessage } from '../services/rules.service';
import { writeToNotion } from '../services/notion.service';
import { logOperation, logError } from '../utils/logger';
import { validateWebhookPayload, sanitizeString } from '../utils/validation';
import { TenantConfig } from '../models';
import { LineWebhookBody, LineMessageEvent, LineTextMessage } from '../types';

/**
 * Main LINE webhook handler
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
        // 1. Method check
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        // 2. Get signature
        const signature = req.headers['x-line-signature'] as string;
        if (!signature) {
            res.status(401).send('Missing signature');
            return;
        }

        // 3. Validate payload
        const validation = validateWebhookPayload(req.body);
        if (!validation.valid) {
            logger.warn('Invalid payload:', validation.error);
            res.status(400).send(validation.error);
            return;
        }

        const { destination, events } = validation as {
            destination: string;
            events: LineWebhookBody['events'];
        };

        // Empty events (e.g., LINE verify request)
        if (!events || events.length === 0) {
            res.status(200).send('OK');
            return;
        }

        // 4. Find tenant configuration
        const tenant = await findTenantByChannelId(destination);
        if (!tenant) {
            logger.warn(`Unknown channel: ${destination}`);
            // Still return 200 to prevent LINE from retrying
            res.status(200).send('OK');
            return;
        }

        // 5. Verify signature
        const rawBody = JSON.stringify(req.body);
        const channelSecret = await getLineChannelSecret(tenant.integrationId);

        if (!verifySignature(rawBody, signature, channelSecret)) {
            logger.error('Invalid signature for channel:', destination);
            res.status(401).send('Invalid signature');
            return;
        }

        // 6. Process events
        const results = await Promise.allSettled(
            events.map(event => processEvent(event, tenant))
        );

        // Log any failures
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            logger.error('Some events failed:', failures);
        }

        const duration = Date.now() - startTime;
        await logOperation({
            teamId: tenant.teamId,
            projectId: tenant.projectId,
            type: 'message_received',
            duration,
        });

        res.status(200).send('OK');

    } catch (error) {
        logger.error('Webhook handler error:', error);
        res.status(500).send('Internal Server Error');
    }
}

/**
 * Process a single LINE event
 */
async function processEvent(
    event: LineWebhookBody['events'][0],
    tenant: TenantConfig
): Promise<void> {
    // Only handle message events for now
    if (event.type !== 'message') {
        return;
    }

    const messageEvent = event as LineMessageEvent;

    // Only handle text messages for now
    if (messageEvent.message.type !== 'text') {
        // TODO: Add support for image/location in future
        return;
    }

    await processTextMessage(messageEvent, tenant);
}

/**
 * Process a text message event
 */
async function processTextMessage(
    event: LineMessageEvent,
    tenant: TenantConfig
): Promise<void> {
    const message = event.message as LineTextMessage;
    const text = sanitizeString(message.text);
    const userId = event.source.type === 'user' ? event.source.userId : 'unknown';
    const replyToken = event.replyToken;

    try {
        // 1. Match rules
        const matchResult = await processMessage(text, tenant.projectId);

        if (!matchResult) {
            // No matching rule found
            if (tenant.settings.replyEnabled) {
                const noMatchMessage = tenant.settings.replyMessages?.noMatch ||
                    '⚠️ 找不到匹配的規則。請使用 #todo、#idea 等標籤。';
                await replyMessage(replyToken, tenant.integrationId, noMatchMessage);
            }

            await logOperation({
                teamId: tenant.teamId,
                projectId: tenant.projectId,
                type: 'message_received',
                message: {
                    lineUserId: userId,
                    messageType: 'text',
                    contentPreview: text.substring(0, 100),
                },
            });

            return;
        }

        // 2. Write to Notion
        const notionResult = await writeToNotion({
            integrationId: tenant.notionIntegrationId,
            databaseId: matchResult.databaseId,
            properties: matchResult.properties,
        });

        // 3. Log the operation
        await logOperation({
            teamId: tenant.teamId,
            projectId: tenant.projectId,
            type: 'notion_write',
            message: {
                lineUserId: userId,
                messageType: 'text',
                contentPreview: text.substring(0, 100),
                matchedRuleId: matchResult.ruleId,
            },
            notion: {
                databaseId: matchResult.databaseId,
                pageId: notionResult.pageId,
                status: notionResult.success ? 'success' : 'failed',
                errorMessage: notionResult.error,
            },
        });

        // 4. Reply to user
        if (tenant.settings.replyEnabled) {
            const replyText = notionResult.success
                ? (tenant.settings.replyMessages?.success || '✅ 已成功寫入 Notion！')
                : (tenant.settings.replyMessages?.failure || '❌ 寫入失敗，請稍後再試。');

            await replyMessage(replyToken, tenant.integrationId, replyText);
        }

    } catch (error) {
        await logError(tenant.teamId, error as Error, {
            projectId: tenant.projectId,
            messagePreview: text.substring(0, 50),
        });

        // Try to reply with error message
        if (tenant.settings.replyEnabled) {
            try {
                await replyMessage(
                    replyToken,
                    tenant.integrationId,
                    '❌ 處理訊息時發生錯誤，請稍後再試。'
                );
            } catch {
                // Ignore reply errors
            }
        }

        throw error;
    }
}
