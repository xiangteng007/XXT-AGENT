/**
 * Worker Handler - Processes jobs from the queue (v2 with image/location support)
 * 
 * Triggered by: Cloud Scheduler (every minute) or HTTP
 */
import { logger } from 'firebase-functions/v2';
import { Request, Response } from 'express';
import {
    fetchQueuedJobs,
    claimJob,
    completeJob,
    failJob,
    markEventProcessed,
} from '../services/queue.service';
import { writeToNotion } from '../services/notion.service';
import { uploadLineImage } from '../services/storage.service';
import { logNotionWritten, logAuditError } from '../services/audit.service';
import { incrementOkCount, incrementFailedCount, incrementDlqCount, incrementNotion429, incrementNotion5xx, recordLatency } from '../services/metrics.service';
import { Job } from '../models/job.model';
import { NotionProperties } from '../types';

const BATCH_SIZE = 5;

/**
 * Main worker entry point
 */
export async function handleWorker(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
        // Fetch queued jobs
        const jobs = await fetchQueuedJobs(BATCH_SIZE);

        if (jobs.length === 0) {
            res.status(200).json({ processed: 0, message: 'No jobs in queue' });
            return;
        }

        logger.info(`[Worker] Processing ${jobs.length} job(s)`);

        const results = await Promise.allSettled(
            jobs.map(job => processJob(job))
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        const duration = Date.now() - startTime;

        res.status(200).json({
            processed: jobs.length,
            succeeded,
            failed,
            duration,
        });

    } catch (error) {
        logger.error('[Worker] Handler error:', error);
        res.status(500).json({ error: 'Worker error' });
    }
}

/**
 * Process a single job (routes by message type)
 */
async function processJob(job: Job): Promise<void> {
    const startTime = Date.now();

    // Try to claim the job (atomic)
    const claimed = await claimJob(job.id);
    if (!claimed) {
        logger.info(`[Worker] Job ${job.id} already claimed, skipping`);
        return;
    }

    logger.info(`[Worker] Processing job ${job.id} type=${job.eventType} (attempt ${job.attempts + 1})`);

    try {
        const payload = job.payload;
        let properties: NotionProperties;

        // Route by message type
        switch (payload.messageType) {
            case 'text':
                properties = (payload.properties || buildTextProperties(payload.text || '')) as unknown as NotionProperties;
                break;
            case 'image':
                properties = await buildImageProperties(job);
                break;
            case 'location':
                properties = buildLocationProperties(job);
                break;
            default:
                properties = (payload.properties || {}) as unknown as NotionProperties;
        }

        // Write to Notion
        const result = await writeToNotion({
            integrationId: payload.notionIntegrationId,
            databaseId: payload.databaseId,
            properties,
        });

        if (!result.success) {
            // Check for rate limit or server error
            if (result.statusCode === 429) {
                await incrementNotion429(payload.tenantId);
            } else if (result.statusCode && result.statusCode >= 500) {
                await incrementNotion5xx(payload.tenantId);
            }

            throw new Error(result.error || 'Notion write failed');
        }

        // Success
        await completeJob(job.id);
        await markEventProcessed(job.webhookEventId, payload.tenantId);
        await incrementOkCount(payload.tenantId);

        const latency = Date.now() - startTime;
        await recordLatency(payload.tenantId, latency);

        await logNotionWritten(
            payload.tenantId,
            job.id,
            true,
            result.pageId,
            payload.databaseId
        );

        logger.info(`[Worker] Job ${job.id} completed in ${latency}ms`);

    } catch (error) {
        const err = error as Error;
        logger.error(`[Worker] Job ${job.id} failed:`, err.message);

        await failJob(job.id, err);
        await incrementFailedCount(job.payload.tenantId);

        // Check if this was the final attempt (job is now dead)
        if (job.attempts + 1 >= job.maxAttempts) {
            await incrementDlqCount(job.payload.tenantId);
        }

        await logNotionWritten(
            job.payload.tenantId,
            job.id,
            false,
            undefined,
            job.payload.databaseId,
            err.message
        );

        await logAuditError(job.payload.tenantId, err, { jobId: job.id });

        throw error; // Re-throw for Promise.allSettled tracking
    }
}

/**
 * Build text message Notion properties
 */
function buildTextProperties(text: string): NotionProperties {
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
async function buildImageProperties(job: Job): Promise<NotionProperties> {
    const payload = job.payload;
    const messageId = payload.text?.replace('__IMAGE__:', '') || '';

    // Upload image to Cloud Storage
    const imageUrl = await uploadLineImage(
        messageId,
        payload.integrationId,
        payload.tenantId
    );

    const time = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

    const properties: NotionProperties = {
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
    } else {
        properties['Content'] = {
            rich_text: [{ text: { content: '圖片上傳失敗' } }],
        };
    }

    return properties;
}

/**
 * Build location message Notion properties
 */
function buildLocationProperties(job: Job): NotionProperties {
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
