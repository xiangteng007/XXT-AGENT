"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = handleWebhook;
const secrets_service_1 = require("../services/secrets.service");
const line_service_1 = require("../services/line.service");
const tenant_service_1 = require("../services/tenant.service");
const rules_service_1 = require("../services/rules.service");
const notion_service_1 = require("../services/notion.service");
const logger_1 = require("../utils/logger");
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
        // 3. Validate payload
        const validation = (0, validation_1.validateWebhookPayload)(req.body);
        if (!validation.valid) {
            console.warn('Invalid payload:', validation.error);
            res.status(400).send(validation.error);
            return;
        }
        const { destination, events } = validation;
        // Empty events (e.g., LINE verify request)
        if (!events || events.length === 0) {
            res.status(200).send('OK');
            return;
        }
        // 4. Find tenant configuration
        const tenant = await (0, tenant_service_1.findTenantByChannelId)(destination);
        if (!tenant) {
            console.warn(`Unknown channel: ${destination}`);
            // Still return 200 to prevent LINE from retrying
            res.status(200).send('OK');
            return;
        }
        // 5. Verify signature
        const rawBody = JSON.stringify(req.body);
        const channelSecret = await (0, secrets_service_1.getLineChannelSecret)(tenant.integrationId);
        if (!(0, line_service_1.verifySignature)(rawBody, signature, channelSecret)) {
            console.error('Invalid signature for channel:', destination);
            res.status(401).send('Invalid signature');
            return;
        }
        // 6. Process events
        const results = await Promise.allSettled(events.map(event => processEvent(event, tenant)));
        // Log any failures
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error('Some events failed:', failures);
        }
        const duration = Date.now() - startTime;
        await (0, logger_1.logOperation)({
            teamId: tenant.teamId,
            projectId: tenant.projectId,
            type: 'message_received',
            duration,
        });
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).send('Internal Server Error');
    }
}
/**
 * Process a single LINE event
 */
async function processEvent(event, tenant) {
    // Only handle message events for now
    if (event.type !== 'message') {
        return;
    }
    const messageEvent = event;
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
async function processTextMessage(event, tenant) {
    const message = event.message;
    const text = (0, validation_1.sanitizeString)(message.text);
    const userId = event.source.type === 'user' ? event.source.userId : 'unknown';
    const replyToken = event.replyToken;
    try {
        // 1. Match rules
        const matchResult = await (0, rules_service_1.processMessage)(text, tenant.projectId);
        if (!matchResult) {
            // No matching rule found
            if (tenant.settings.replyEnabled) {
                const noMatchMessage = tenant.settings.replyMessages?.noMatch ||
                    '⚠️ 找不到匹配的規則。請使用 #todo、#idea 等標籤。';
                await (0, line_service_1.replyMessage)(replyToken, tenant.integrationId, noMatchMessage);
            }
            await (0, logger_1.logOperation)({
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
        const notionResult = await (0, notion_service_1.writeToNotion)({
            integrationId: tenant.notionIntegrationId,
            databaseId: matchResult.databaseId,
            properties: matchResult.properties,
        });
        // 3. Log the operation
        await (0, logger_1.logOperation)({
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
            await (0, line_service_1.replyMessage)(replyToken, tenant.integrationId, replyText);
        }
    }
    catch (error) {
        await (0, logger_1.logError)(tenant.teamId, error, {
            projectId: tenant.projectId,
            messagePreview: text.substring(0, 50),
        });
        // Try to reply with error message
        if (tenant.settings.replyEnabled) {
            try {
                await (0, line_service_1.replyMessage)(replyToken, tenant.integrationId, '❌ 處理訊息時發生錯誤，請稍後再試。');
            }
            catch {
                // Ignore reply errors
            }
        }
        throw error;
    }
}
//# sourceMappingURL=webhook.handler.js.map