/**
 * Social Collector Worker Service
 * 
 * Processes individual collect jobs from Cloud Tasks.
 * Fetches posts using adapters, enriches with Gemini, stores to Firestore.
 */

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import {
    SocialSource,
    SocialCursor,
    NormalizedPost,
    FusedEvent,
    CollectJob,
    SocialAdapter,
} from '../types/social.types';
import { createRSSAdapter } from './adapters/rss.adapter';
import { enrichWithGemini } from './gemini-enricher.service';
import { logAudit } from './audit.service';
import { incrementMetric } from './metrics.service';
import { getErrorMessage } from '../utils/error-handling';

const db = admin.firestore();

// Adapter registry
const adapters: Record<string, () => SocialAdapter> = {
    rss: createRSSAdapter,
    // facebook: createFacebookAdapter,
    // instagram: createInstagramAdapter,
    // twitter: createTwitterAdapter,
    // ptt: createPTTAdapter,
};

/**
 * Process a collect job
 */
export async function processCollectJob(job: CollectJob): Promise<{
    fetched: number;
    inserted: number;
    deduplicated: number;
    errors: string[];
}> {
    logger.info(`[Social Collector] Processing job: ${job.tenantId}/${job.sourceId}`);

    const result = { fetched: 0, inserted: 0, deduplicated: 0, errors: [] as string[] };

    try {
        // Load source configuration
        const sourceDoc = await db
            .collection('social_sources')
            .doc(job.tenantId)
            .collection('sources')
            .doc(job.sourceId)
            .get();

        if (!sourceDoc.exists) {
            throw new Error(`Source not found: ${job.tenantId}/${job.sourceId}`);
        }

        const source = { id: sourceDoc.id, ...sourceDoc.data() } as SocialSource;

        // Get adapter
        const adapterFactory = adapters[source.platform];
        if (!adapterFactory) {
            throw new Error(`No adapter for platform: ${source.platform}`);
        }
        const adapter = adapterFactory();

        // Load cursor
        const cursorId = `${job.tenantId}_${job.sourceId}`;
        const cursorDoc = await db.collection('social_cursors').doc(cursorId).get();
        const cursor: SocialCursor = cursorDoc.exists
            ? { id: cursorId, ...cursorDoc.data() } as SocialCursor
            : {
                id: cursorId,
                cursorType: 'sinceTs',
                cursorValue: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
                lastSuccessAt: null,
                lastErrorAt: null,
                errorCount: 0,
                updatedAt: new Date(),
            };

        // Fetch delta
        const fetchResult = await adapter.fetchDelta(cursor, source.config);
        result.fetched = fetchResult.items.length;

        logger.info(`[Social Collector] Fetched ${result.fetched} items from ${source.platform}`);

        // Process each item
        for (const item of fetchResult.items) {
            try {
                const normalized = adapter.mapToNormalized(item, source);

                // Check dedup
                const isDuplicate = await checkDuplicate(normalized);
                if (isDuplicate) {
                    result.deduplicated++;
                    continue;
                }

                // Enrich with Gemini
                const enriched = await enrichPost(normalized);

                // Store post
                await storePost(enriched);
                result.inserted++;

                // Create fused event if high severity
                if (enriched.severity >= 50 || enriched.urgency >= 7) {
                    await createFusedEvent(enriched);
                }

            } catch (itemErr: unknown) {
                logger.error('[Social Collector] Error processing item:', itemErr);
                result.errors.push(getErrorMessage(itemErr));
            }
        }

        // Update cursor
        await db.collection('social_cursors').doc(cursorId).set({
            ...cursor,
            ...fetchResult.nextCursor,
            lastSuccessAt: admin.firestore.FieldValue.serverTimestamp(),
            errorCount: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // Log metrics
        await incrementMetric(job.tenantId, 'social_posts_fetched', result.fetched);
        await incrementMetric(job.tenantId, 'social_posts_inserted', result.inserted);

        logger.info('[Social Collector] Job complete:', result);
        return result;

    } catch (err: unknown) {
        logger.error('[Social Collector] Job failed:', err);

        // Update cursor error state
        const cursorId = `${job.tenantId}_${job.sourceId}`;
        await db.collection('social_cursors').doc(cursorId).set({
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
            errorCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        const errorMessage = getErrorMessage(err);
        await logAudit({
            tenantId: job.tenantId,
            type: 'error',
            action: 'social_collect_failed',
            details: { sourceId: job.sourceId, error: errorMessage },
        });

        result.errors.push(errorMessage);
        return result;
    }
}

/**
 * Check if post is duplicate (within 5-min window)
 */
async function checkDuplicate(post: NormalizedPost): Promise<boolean> {
    // Check by postKey (primary key dedup)
    const existingDoc = await db.collection('social_posts').doc(post.postKey).get();
    if (existingDoc.exists) {
        // Update engagement only
        await db.collection('social_posts').doc(post.postKey).update({
            engagement: post.engagement,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    }

    // Check by dedupHash (content dedup) within 5-min window
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const hashDupes = await db.collection('social_posts')
        .where('dedupHash', '==', post.dedupHash)
        .where('insertedAt', '>=', fiveMinAgo)
        .limit(1)
        .get();

    return !hashDupes.empty;
}

/**
 * Enrich post with Gemini AI
 */
async function enrichPost(post: NormalizedPost): Promise<NormalizedPost> {
    try {
        const enrichment = await enrichWithGemini({
            type: 'social',
            content: `${post.title}\n\n${post.summary}`,
            context: {
                platform: post.platform,
                location: post.location,
                existingKeywords: post.keywords,
            },
        });

        return {
            ...post,
            severity: enrichment.severity,
            sentiment: enrichment.sentiment,
            keywords: [...new Set([...post.keywords, ...enrichment.keywords])],
            entities: [...post.entities, ...enrichment.entities],
        };
    } catch (err) {
        logger.warn('[Social Collector] Gemini enrichment failed, using raw data:', err);
        return post;
    }
}

/**
 * Store post to Firestore
 */
async function storePost(post: NormalizedPost): Promise<void> {
    await db.collection('social_posts').doc(post.postKey).set({
        ...post,
        insertedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * Create fused event from high-severity post
 */
async function createFusedEvent(post: NormalizedPost): Promise<void> {
    const eventType = post.severity >= 70
        ? 'geo.alert.received'
        : 'geo.social_intel.detected';

    const event: Omit<FusedEvent, 'id'> = {
        ts: new Date(),
        tenantId: post.tenantId,
        domain: 'social',
        eventType,
        title: post.title,
        severity: post.severity,
        direction: post.sentiment === 'positive' ? 'positive'
            : post.sentiment === 'negative' ? 'negative'
                : 'neutral',
        sentiment: post.sentiment,
        keywords: post.keywords,
        entities: post.entities,
        location: post.location,
        url: post.url,
        engagement: post.engagement,
        rawRef: { postKey: post.postKey },
    };

    await db.collection('fused_events').add({
        ...event,
        ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`[Social Collector] Created fused event: ${eventType}`);
}

/**
 * Generate dedup hash
 */
export function generateDedupHash(title: string, url: string, createdAt: Date): string {
    const dateStr = createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
    const input = `${title}|${url}|${dateStr}`;
    return crypto.createHash('sha256').update(input).digest('hex');
}
