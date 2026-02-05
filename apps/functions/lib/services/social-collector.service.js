"use strict";
/**
 * Social Collector Worker Service
 *
 * Processes individual collect jobs from Cloud Tasks.
 * Fetches posts using adapters, enriches with Gemini, stores to Firestore.
 */
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
exports.processCollectJob = processCollectJob;
exports.generateDedupHash = generateDedupHash;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const rss_adapter_1 = require("./adapters/rss.adapter");
const gemini_enricher_service_1 = require("./gemini-enricher.service");
const audit_service_1 = require("./audit.service");
const metrics_service_1 = require("./metrics.service");
const error_handling_1 = require("../utils/error-handling");
const db = admin.firestore();
// Adapter registry
const adapters = {
    rss: rss_adapter_1.createRSSAdapter,
    // facebook: createFacebookAdapter,
    // instagram: createInstagramAdapter,
    // twitter: createTwitterAdapter,
    // ptt: createPTTAdapter,
};
/**
 * Process a collect job
 */
async function processCollectJob(job) {
    console.log(`[Social Collector] Processing job: ${job.tenantId}/${job.sourceId}`);
    const result = { fetched: 0, inserted: 0, deduplicated: 0, errors: [] };
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
        const source = { id: sourceDoc.id, ...sourceDoc.data() };
        // Get adapter
        const adapterFactory = adapters[source.platform];
        if (!adapterFactory) {
            throw new Error(`No adapter for platform: ${source.platform}`);
        }
        const adapter = adapterFactory();
        // Load cursor
        const cursorId = `${job.tenantId}_${job.sourceId}`;
        const cursorDoc = await db.collection('social_cursors').doc(cursorId).get();
        const cursor = cursorDoc.exists
            ? { id: cursorId, ...cursorDoc.data() }
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
        console.log(`[Social Collector] Fetched ${result.fetched} items from ${source.platform}`);
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
            }
            catch (itemErr) {
                console.error('[Social Collector] Error processing item:', itemErr);
                result.errors.push((0, error_handling_1.getErrorMessage)(itemErr));
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
        await (0, metrics_service_1.incrementMetric)(job.tenantId, 'social_posts_fetched', result.fetched);
        await (0, metrics_service_1.incrementMetric)(job.tenantId, 'social_posts_inserted', result.inserted);
        console.log('[Social Collector] Job complete:', result);
        return result;
    }
    catch (err) {
        console.error('[Social Collector] Job failed:', err);
        // Update cursor error state
        const cursorId = `${job.tenantId}_${job.sourceId}`;
        await db.collection('social_cursors').doc(cursorId).set({
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
            errorCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const errorMessage = (0, error_handling_1.getErrorMessage)(err);
        await (0, audit_service_1.logAudit)({
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
async function checkDuplicate(post) {
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
async function enrichPost(post) {
    try {
        const enrichment = await (0, gemini_enricher_service_1.enrichWithGemini)({
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
    }
    catch (err) {
        console.warn('[Social Collector] Gemini enrichment failed, using raw data:', err);
        return post;
    }
}
/**
 * Store post to Firestore
 */
async function storePost(post) {
    await db.collection('social_posts').doc(post.postKey).set({
        ...post,
        insertedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
/**
 * Create fused event from high-severity post
 */
async function createFusedEvent(post) {
    const eventType = post.severity >= 70
        ? 'geo.alert.received'
        : 'geo.social_intel.detected';
    const event = {
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
    console.log(`[Social Collector] Created fused event: ${eventType}`);
}
/**
 * Generate dedup hash
 */
function generateDedupHash(title, url, createdAt) {
    const dateStr = createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
    const input = `${title}|${url}|${dateStr}`;
    return crypto.createHash('sha256').update(input).digest('hex');
}
//# sourceMappingURL=social-collector.service.js.map