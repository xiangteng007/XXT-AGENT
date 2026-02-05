"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = handleWebhook;
const secrets_service_1 = require("../services/secrets.service");
const line_service_1 = require("../services/line.service");
const tenant_service_1 = require("../services/tenant.service");
const rules_service_1 = require("../services/rules.service");
const queue_service_1 = require("../services/queue.service");
const audit_service_1 = require("../services/audit.service");
const validation_1 = require("../utils/validation");
/**
 * Main LINE webhook handler
 */
async function handleWebhook(req, res) {
    const startTime = Date.now();
    try {
        // 1. Method check
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        // 2. Get signature
        const signature = req.headers['x-line-signature'];
        if (!signature) {
            res.status(401).send('Missing signature');
            return;
        }
        // 3. Get raw body for signature verification
        // Cloud Functions Gen 2 provides rawBody
        const reqWithRawBody = req;
        const rawBody = reqWithRawBody.rawBody?.toString('utf-8') || JSON.stringify(req.body);
        // 4. Parse body
        const body = req.body;
        const destination = body.destination;
        const events = body.events || [];
        // Empty events (e.g., LINE verify request)
        if (events.length === 0) {
            res.status(200).send('OK');
            return;
        }
        // 5. Find tenant configuration
        const tenant = await (0, tenant_service_1.findTenantByChannelId)(destination);
        if (!tenant) {
            console.warn(`Unknown channel: ${destination}`);
            // Still return 200 to prevent LINE from retrying
            res.status(200).send('OK');
            return;
        }
        // 6. Verify signature
        const channelSecret = await (0, secrets_service_1.getLineChannelSecret)(tenant.integrationId);
        if (!(0, line_service_1.verifySignature)(rawBody, signature, channelSecret)) {
            console.error('Invalid signature for channel:', destination);
            res.status(401).send('Invalid signature');
            return;
        }
        // 7. Log webhook received
        const webhookEventId = events[0]?.webhookEventId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await (0, audit_service_1.logWebhookReceived)(tenant.teamId, events.length, webhookEventId);
        // 8. Process events (enqueue, don't wait for Notion)
        const results = await Promise.allSettled(events.map((event, index) => processEvent(event, tenant, `${webhookEventId}-${index}`)));
        // Log any failures
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error('Some events failed to enqueue:', failures);
        }
        const duration = Date.now() - startTime;
        console.log(`[Webhook] Processed ${events.length} events in ${duration}ms`);
        // Fast ACK
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).send('Internal Server Error');
    }
}
/**
 * Process a single LINE event (enqueue job)
 */
async function processEvent(event, tenant, webhookEventId) {
    // Only handle message events for now
    if (event.type !== 'message') {
        return;
    }
    const messageEvent = event;
    // Check deduplication
    const eventKey = `${tenant.teamId}:${messageEvent.message.id}`;
    if (await (0, queue_service_1.isEventProcessed)(eventKey)) {
        console.log(`[Webhook] Event ${eventKey} already processed, skipping`);
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
            console.log(`[Webhook] Unsupported message type: ${messageEvent.message.type}`);
    }
}
/**
 * Process a text message event (enqueue job)
 */
async function processTextMessage(event, tenant, webhookEventId) {
    const message = event.message;
    const text = (0, validation_1.sanitizeString)(message.text);
    const userId = event.source.type === 'user' ? event.source.userId : 'unknown';
    const replyToken = event.replyToken;
    try {
        // 1. Match rules
        const matchResult = await (0, rules_service_1.processMessage)(text, tenant.projectId);
        if (!matchResult) {
            // No matching rule found - reply immediately (optional)
            if (tenant.settings.replyEnabled && replyToken) {
                const noMatchMessage = tenant.settings.replyMessages?.noMatch ||
                    '⚠️ 找不到匹配的規則。請使用 #todo、#idea 等標籤。';
                await (0, line_service_1.replyMessage)(replyToken, tenant.integrationId, noMatchMessage);
            }
            return;
        }
        // 2. Build job payload
        const payload = {
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
        const jobId = await (0, queue_service_1.enqueueJob)(payload, webhookEventId);
        // 4. Log job enqueued
        await (0, audit_service_1.logJobEnqueued)(tenant.teamId, jobId, 'text', webhookEventId);
        // 5. Quick reply that we received the message
        if (tenant.settings.replyEnabled && replyToken) {
            // Optional: Send "processing" reply
            // Note: For better UX, you might skip this and only reply on completion
            // But completion happens in worker, and replyToken may expire
            // So we send immediate acknowledgment here
            try {
                await (0, line_service_1.replyMessage)(replyToken, tenant.integrationId, '📝 收到！正在處理...');
            }
            catch {
                // Ignore reply errors - replyToken may have expired
            }
        }
    }
    catch (error) {
        await (0, audit_service_1.logAuditError)(tenant.teamId, error, {
            webhookEventId,
            messagePreview: text.substring(0, 50),
        });
        throw error;
    }
}
/**
 * Process an image message event (enqueue job)
 */
async function processImageMessage(event, tenant, webhookEventId) {
    const message = event.message;
    const userId = event.source.type === 'user' ? event.source.userId : 'unknown';
    const replyToken = event.replyToken;
    try {
        // Build job payload for image
        const payload = {
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
        const jobId = await (0, queue_service_1.enqueueJob)(payload, webhookEventId);
        await (0, audit_service_1.logJobEnqueued)(tenant.teamId, jobId, 'image', webhookEventId);
        // Quick reply
        if (tenant.settings.replyEnabled && replyToken) {
            try {
                await (0, line_service_1.replyMessage)(replyToken, tenant.integrationId, '📷 圖片收到！正在處理...');
            }
            catch {
                // Ignore reply errors
            }
        }
    }
    catch (error) {
        await (0, audit_service_1.logAuditError)(tenant.teamId, error, {
            webhookEventId,
            messageType: 'image',
        });
        throw error;
    }
}
/**
 * Process a location message event (enqueue job)
 */
async function processLocationMessage(event, tenant, webhookEventId) {
    const message = event.message;
    const userId = event.source.type === 'user' ? event.source.userId : 'unknown';
    const replyToken = event.replyToken;
    try {
        // Build job payload for location
        const googleMapsUrl = `https://www.google.com/maps?q=${message.latitude},${message.longitude}`;
        const payload = {
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
        const jobId = await (0, queue_service_1.enqueueJob)(payload, webhookEventId);
        await (0, audit_service_1.logJobEnqueued)(tenant.teamId, jobId, 'location', webhookEventId);
        // Quick reply
        if (tenant.settings.replyEnabled && replyToken) {
            try {
                await (0, line_service_1.replyMessage)(replyToken, tenant.integrationId, '📍 位置收到！正在處理...');
            }
            catch {
                // Ignore reply errors
            }
        }
    }
    catch (error) {
        await (0, audit_service_1.logAuditError)(tenant.teamId, error, {
            webhookEventId,
            messageType: 'location',
        });
        throw error;
    }
}
//# sourceMappingURL=webhook.handler.v2.js.map