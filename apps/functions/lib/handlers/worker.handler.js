"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWorker = handleWorker;
const queue_service_1 = require("../services/queue.service");
const notion_service_1 = require("../services/notion.service");
const storage_service_1 = require("../services/storage.service");
const audit_service_1 = require("../services/audit.service");
const metrics_service_1 = require("../services/metrics.service");
const BATCH_SIZE = 5;
/**
 * Main worker entry point
 */
async function handleWorker(req, res) {
    const startTime = Date.now();
    try {
        // Fetch queued jobs
        const jobs = await (0, queue_service_1.fetchQueuedJobs)(BATCH_SIZE);
        if (jobs.length === 0) {
            res.status(200).json({ processed: 0, message: 'No jobs in queue' });
            return;
        }
        console.log(`[Worker] Processing ${jobs.length} job(s)`);
        const results = await Promise.allSettled(jobs.map(job => processJob(job)));
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const duration = Date.now() - startTime;
        res.status(200).json({
            processed: jobs.length,
            succeeded,
            failed,
            duration,
        });
    }
    catch (error) {
        console.error('[Worker] Handler error:', error);
        res.status(500).json({ error: 'Worker error' });
    }
}
/**
 * Process a single job (routes by message type)
 */
async function processJob(job) {
    const startTime = Date.now();
    // Try to claim the job (atomic)
    const claimed = await (0, queue_service_1.claimJob)(job.id);
    if (!claimed) {
        console.log(`[Worker] Job ${job.id} already claimed, skipping`);
        return;
    }
    console.log(`[Worker] Processing job ${job.id} type=${job.eventType} (attempt ${job.attempts + 1})`);
    try {
        const payload = job.payload;
        let properties;
        // Route by message type
        switch (payload.messageType) {
            case 'text':
                properties = (payload.properties || buildTextProperties(payload.text || ''));
                break;
            case 'image':
                properties = await buildImageProperties(job);
                break;
            case 'location':
                properties = buildLocationProperties(job);
                break;
            default:
                properties = (payload.properties || {});
        }
        // Write to Notion
        const result = await (0, notion_service_1.writeToNotion)({
            integrationId: payload.notionIntegrationId,
            databaseId: payload.databaseId,
            properties,
        });
        if (!result.success) {
            // Check for rate limit or server error
            if (result.statusCode === 429) {
                await (0, metrics_service_1.incrementNotion429)(payload.tenantId);
            }
            else if (result.statusCode && result.statusCode >= 500) {
                await (0, metrics_service_1.incrementNotion5xx)(payload.tenantId);
            }
            throw new Error(result.error || 'Notion write failed');
        }
        // Success
        await (0, queue_service_1.completeJob)(job.id);
        await (0, queue_service_1.markEventProcessed)(job.webhookEventId, payload.tenantId);
        await (0, metrics_service_1.incrementOkCount)(payload.tenantId);
        const latency = Date.now() - startTime;
        await (0, metrics_service_1.recordLatency)(payload.tenantId, latency);
        await (0, audit_service_1.logNotionWritten)(payload.tenantId, job.id, true, result.pageId, payload.databaseId);
        console.log(`[Worker] Job ${job.id} completed in ${latency}ms`);
    }
    catch (error) {
        const err = error;
        console.error(`[Worker] Job ${job.id} failed:`, err.message);
        await (0, queue_service_1.failJob)(job.id, err);
        await (0, metrics_service_1.incrementFailedCount)(job.payload.tenantId);
        // Check if this was the final attempt (job is now dead)
        if (job.attempts + 1 >= job.maxAttempts) {
            await (0, metrics_service_1.incrementDlqCount)(job.payload.tenantId);
        }
        await (0, audit_service_1.logNotionWritten)(job.payload.tenantId, job.id, false, undefined, job.payload.databaseId, err.message);
        await (0, audit_service_1.logAuditError)(job.payload.tenantId, err, { jobId: job.id });
        throw error; // Re-throw for Promise.allSettled tracking
    }
}
/**
 * Build text message Notion properties
 */
function buildTextProperties(text) {
    // Extract first line as title
    const lines = text.split('\n');
    const title = lines[0].substring(0, 100);
    return {
        Name: { title: [{ text: { content: title } }] },
        Content: { rich_text: [{ text: { content: text } }] },
        Date: { date: { start: new Date().toISOString().split('T')[0] } },
        Source: { select: { name: 'LINE' } },
    };
}
/**
 * Build image message Notion properties (with Cloud Storage upload)
 */
async function buildImageProperties(job) {
    const payload = job.payload;
    const messageId = payload.text?.replace('__IMAGE__:', '') || '';
    // Upload image to Cloud Storage
    const imageUrl = await (0, storage_service_1.uploadLineImage)(messageId, payload.integrationId, payload.tenantId);
    const time = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const properties = {
        Name: { title: [{ text: { content: `📷 圖片 - ${time}` } }] },
        Date: { date: { start: new Date().toISOString().split('T')[0] } },
        Source: { select: { name: 'LINE' } },
    };
    // Add image if upload succeeded
    if (imageUrl) {
        properties['Attachments'] = {
            files: [{
                    type: 'external',
                    name: 'LINE Image',
                    external: { url: imageUrl },
                }],
        };
        properties['Content'] = {
            rich_text: [{ text: { content: `Image: ${imageUrl}` } }],
        };
    }
    else {
        properties['Content'] = {
            rich_text: [{ text: { content: '圖片上傳失敗' } }],
        };
    }
    return properties;
}
/**
 * Build location message Notion properties
 */
function buildLocationProperties(job) {
    const payload = job.payload;
    const location = payload.location;
    const time = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const title = location ? `📍 ${location.title} - ${time}` : `📍 位置 - ${time}`;
    const googleMapsUrl = location
        ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
        : '';
    const content = location
        ? [location.title, location.address, `座標: ${location.latitude}, ${location.longitude}`, googleMapsUrl].filter(Boolean).join('\n')
        : payload.text || '';
    return {
        Name: { title: [{ text: { content: title } }] },
        Content: { rich_text: [{ text: { content: content } }] },
        Date: { date: { start: new Date().toISOString().split('T')[0] } },
        Source: { select: { name: 'LINE' } },
    };
}
//# sourceMappingURL=worker.handler.js.map