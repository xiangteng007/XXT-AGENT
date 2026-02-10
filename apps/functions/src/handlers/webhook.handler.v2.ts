/**
 * Main LINE webhook handler (Refactored for Queue Architecture)
 * 
 * Changes from original:
 * 1. Uses actual rawBody (not JSON.stringify)
 * 2. Enqueues jobs instead of direct Notion writes
 * 3. Fast ACK (< 3 seconds target)
 * 4. Deduplication via processedEvents
 */
import { logger } from 'firebase-functions/v2';
import { Request, Response } from 'express';
import { getLineChannelSecret } from '../services/secrets.service';
import { verifySignature, replyMessage } from '../services/line.service';
import { findTenantByChannelId } from '../services/tenant.service';
import { processMessage } from '../services/rules.service';
import { enqueueJob, isEventProcessed } from '../services/queue.service';
import { logWebhookReceived, logJobEnqueued, logAuditError } from '../services/audit.service';
import { sanitizeString } from '../utils/validation';
import { TenantConfig } from '../models';
import { JobPayload } from '../models/job.model';
import { LineWebhookBody, LineMessageEvent, LineTextMessage, LineImageMessage, LineLocationMessage } from '../types';

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

        // 3. Get raw body for signature verification
        // Cloud Functions Gen 2 provides rawBody
        const reqWithRawBody = req as Request & { rawBody?: Buffer };
        const rawBody = reqWithRawBody.rawBody?.toString('utf-8') || JSON.stringify(req.body);

        // 4. Parse body
        const body = req.body as LineWebhookBody;
        const destination = body.destination;
        const events = body.events || [];

        // Empty events (e.g., LINE verify request)
        if (events.length === 0) {
            res.status(200).send('OK');
            return;
        }

        // 5. Find tenant configuration
        const tenant = await findTenantByChannelId(destination);
        if (!tenant) {
            logger.warn(`Unknown channel: ${destination}`);
            // Still return 200 to prevent LINE from retrying
            res.status(200).send('OK');
            return;
        }

        // 6. Verify signature
        const channelSecret = await getLineChannelSecret(tenant.integrationId);

        if (!verifySignature(rawBody, signature, channelSecret)) {
            logger.error('Invalid signature for channel:', destination);
            res.status(401).send('Invalid signature');
            return;
        }

        // 7. Log webhook received
        const webhookEventId = events[0]?.webhookEventId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await logWebhookReceived(tenant.teamId, events.length, webhookEventId);

        // 8. Process events (enqueue, don't wait for Notion)
        const results = await Promise.allSettled(
            events.map((event, index) => processEvent(event, tenant, `${webhookEventId}-${index}`))
        );

        // Log any failures
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            logger.error('Some events failed to enqueue:', failures);
        }

        const duration = Date.now() - startTime;
        logger.info(`[Webhook] Processed ${events.length} events in ${duration}ms`);

        // Fast ACK
        res.status(200).send('OK');

    } catch (error) {
        logger.error('Webhook handler error:', error);
        res.status(500).send('Internal Server Error');
    }
}

/**
 * Process a single LINE event (enqueue job)
 */
async function processEvent(
    event: LineWebhookBody['events'][0],
    tenant: TenantConfig,
    webhookEventId: string
): Promise<void> {
    // Only handle message events for now
    if (event.type !== 'message') {
        return;
    }

    const messageEvent = event as LineMessageEvent;

    // Check deduplication
    const eventKey = `${tenant.teamId}:${messageEvent.message.id}`;
    if (await isEventProcessed(eventKey)) {
        logger.info(`[Webhook] Event ${eventKey} already processed, skipping`);
        return;
    }

    // Route by message type
    switch (messageEvent.message.type) {
        case 'text':
            await processTextMessage(messageEvent, tenant, webhookEventId);
            break;
        case 'image':
            await processImageMessage(messageEvent, tenant, webhookEventId);
            break;
        case 'location':
            await processLocationMessage(messageEvent, tenant, webhookEventId);
            break;
        default:
            // Unsupported message type (sticker, etc.) - silently ignore
            logger.info(`[Webhook] Unsupported message type: ${messageEvent.message.type}`);
    }
}

/**
 * Process a text message event (enqueue job)
 */
async function processTextMessage(
    event: LineMessageEvent,
    tenant: TenantConfig,
    webhookEventId: string
): Promise<void> {
    const message = event.message as LineTextMessage;
    const text = sanitizeString(message.text);
    const userId = event.source.type === 'user' ? event.source.userId : 'unknown';
    const replyToken = event.replyToken;

    try {
        // 1. Match rules
        const matchResult = await processMessage(text, tenant.projectId);

        if (!matchResult) {
            // No matching rule found - reply immediately (optional)
            if (tenant.settings.replyEnabled && replyToken) {
                const noMatchMessage = tenant.settings.replyMessages?.noMatch ||
                    '⚠️ 找不到匹配的規則。請使用 #todo、#idea 等標籤。';
                await replyMessage(replyToken, tenant.integrationId, noMatchMessage);
            }
            return;
        }

        // 2. Build job payload
        const payload: JobPayload = {
            tenantId: tenant.teamId,
            projectId: tenant.projectId,
            integrationId: tenant.integrationId,
            notionIntegrationId: tenant.notionIntegrationId,
            messageType: 'text',
            text,
            lineUserId: userId,
            replyToken, // Note: expires quickly
            ruleId: matchResult.ruleId,
            databaseId: matchResult.databaseId,
            properties: matchResult.properties,
            replyEnabled: tenant.settings.replyEnabled,
            replyMessages: tenant.settings.replyMessages,
        };

        // 3. Enqueue job (async Notion write)
        const jobId = await enqueueJob(payload, webhookEventId);

        // 4. Log job enqueued
        await logJobEnqueued(tenant.teamId, jobId, 'text', webhookEventId);

        // 5. Quick reply that we received the message
        if (tenant.settings.replyEnabled && replyToken) {
            // Optional: Send "processing" reply
            // Note: For better UX, you might skip this and only reply on completion
            // But completion happens in worker, and replyToken may expire
            // So we send immediate acknowledgment here
            try {
                await replyMessage(replyToken, tenant.integrationId, '📝 收到！正在處理...');
            } catch {
                // Ignore reply errors - replyToken may have expired
            }
        }

    } catch (error) {
        await logAuditError(tenant.teamId, error as Error, {
            webhookEventId,
            messagePreview: text.substring(0, 50),
        });
        throw error;
    }
}

/**
 * Process an image message event (enqueue job)
 */
async function processImageMessage(
    event: LineMessageEvent,
    tenant: TenantConfig,
    webhookEventId: string
): Promise<void> {
    const message = event.message as LineImageMessage;
    const userId = event.source.type === 'user' ? event.source.userId : 'unknown';
    const replyToken = event.replyToken;

    try {
        // Build job payload for image
        const payload: JobPayload = {
            tenantId: tenant.teamId,
            projectId: tenant.projectId,
            integrationId: tenant.integrationId,
            notionIntegrationId: tenant.notionIntegrationId,
            messageType: 'image',
            lineUserId: userId,
            replyToken,
            // Image-specific: store message ID for later download in worker
            text: `__IMAGE__:${message.id}`,
            databaseId: tenant.defaultDatabaseId || '',
            replyEnabled: tenant.settings.replyEnabled,
            replyMessages: tenant.settings.replyMessages,
        };

        // Enqueue job
        const jobId = await enqueueJob(payload, webhookEventId);
        await logJobEnqueued(tenant.teamId, jobId, 'image', webhookEventId);

        // Quick reply
        if (tenant.settings.replyEnabled && replyToken) {
            try {
                await replyMessage(replyToken, tenant.integrationId, '📷 圖片收到！正在處理...');
            } catch {
                // Ignore reply errors
            }
        }

    } catch (error) {
        await logAuditError(tenant.teamId, error as Error, {
            webhookEventId,
            messageType: 'image',
        });
        throw error;
    }
}

/**
 * Process a location message event (enqueue job)
 */
async function processLocationMessage(
    event: LineMessageEvent,
    tenant: TenantConfig,
    webhookEventId: string
): Promise<void> {
    const message = event.message as LineLocationMessage;
    const userId = event.source.type === 'user' ? event.source.userId : 'unknown';
    const replyToken = event.replyToken;

    try {
        // Build job payload for location
        const googleMapsUrl = `https://www.google.com/maps?q=${message.latitude},${message.longitude}`;

        const payload: JobPayload = {
            tenantId: tenant.teamId,
            projectId: tenant.projectId,
            integrationId: tenant.integrationId,
            notionIntegrationId: tenant.notionIntegrationId,
            messageType: 'location',
            lineUserId: userId,
            replyToken,
            location: {
                title: message.title || '位置',
                address: message.address || '',
                latitude: message.latitude,
                longitude: message.longitude,
            },
            // Generate text content for Notion
            text: `📍 ${message.title || '位置'}\n${message.address || ''}\n${googleMapsUrl}`,
            databaseId: tenant.defaultDatabaseId || '',
            replyEnabled: tenant.settings.replyEnabled,
            replyMessages: tenant.settings.replyMessages,
        };

        // Enqueue job
        const jobId = await enqueueJob(payload, webhookEventId);
        await logJobEnqueued(tenant.teamId, jobId, 'location', webhookEventId);

        // Quick reply
        if (tenant.settings.replyEnabled && replyToken) {
            try {
                await replyMessage(replyToken, tenant.integrationId, '📍 位置收到！正在處理...');
            } catch {
                // Ignore reply errors
            }
        }

    } catch (error) {
        await logAuditError(tenant.teamId, error as Error, {
            webhookEventId,
            messageType: 'location',
        });
        throw error;
    }
}
