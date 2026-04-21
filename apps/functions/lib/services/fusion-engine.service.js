"use strict";
/**
 * Fusion Engine Service
 *
 * Correlates events from social + market + news within a sliding window
 * to produce unified fused_events with enhanced severity.
 *
 * Per SPEC_PHASE6_5_PHASE7_CLOUD.md and fusion-policy.md
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
exports.runFusionEngine = runFusionEngine;
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const audit_service_1 = require("./audit.service");
const metrics_service_1 = require("./metrics.service");
const error_handling_1 = require("../utils/error-handling");
const db = admin.firestore();
// Window for correlation (5-10 minutes)
const FUSION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
/**
 * Main fusion function - run every 5 minutes
 */
async function runFusionEngine() {
    v2_1.logger.info('[Fusion Engine] Starting fusion cycle...');
    const result = { processed: 0, fused: 0, errors: [] };
    try {
        const windowStart = new Date(Date.now() - FUSION_WINDOW_MS);
        // Fetch recent events from all domains
        const [socialEvents, marketEvents, newsEvents] = await Promise.all([
            getRecentEvents('social', windowStart),
            getRecentEvents('market', windowStart),
            getRecentEvents('news', windowStart),
        ]);
        result.processed = socialEvents.length + marketEvents.length + newsEvents.length;
        v2_1.logger.info(`[Fusion Engine] Found ${result.processed} events in window`);
        if (result.processed < 2) {
            return result; // Not enough to correlate
        }
        // Find correlations
        const correlations = findCorrelations(socialEvents, marketEvents, newsEvents);
        v2_1.logger.info(`[Fusion Engine] Found ${correlations.length} correlations`);
        // Create fused events
        for (const corr of correlations) {
            try {
                await createFusedEvent(corr);
                result.fused++;
            }
            catch (err) {
                v2_1.logger.error('[Fusion Engine] Failed to create fused event:', err);
                result.errors.push((0, error_handling_1.getErrorMessage)(err));
            }
        }
        await (0, metrics_service_1.incrementMetric)('system', 'fusion_runs_total', 1);
        await (0, metrics_service_1.incrementMetric)('system', 'fusion_events_created', result.fused);
        v2_1.logger.info('[Fusion Engine] Cycle complete:', result);
        return result;
    }
    catch (err) {
        v2_1.logger.error('[Fusion Engine] Fatal error:', err);
        result.errors.push((0, error_handling_1.getErrorMessage)(err));
        return result;
    }
}
/**
 * Get recent events from a domain
 */
async function getRecentEvents(domain, since) {
    const snapshot = await db.collection('fused_events')
        .where('domain', '==', domain)
        .where('ts', '>=', since)
        .orderBy('ts', 'desc')
        .limit(100)
        .get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        ts: doc.data().ts?.toDate?.() || new Date(),
    }));
}
/**
 * Find correlations between events
 */
function findCorrelations(social, market, news) {
    const correlations = [];
    const allEvents = [...social, ...market, ...news];
    const usedEventIds = new Set();
    // Group by ticker entities
    const tickerGroups = new Map();
    for (const event of allEvents) {
        const tickers = event.entities?.filter(e => e.type === 'ticker' || e.type === 'fund' || e.type === 'future') || [];
        for (const ticker of tickers) {
            const key = ticker.value.toUpperCase();
            if (!tickerGroups.has(key)) {
                tickerGroups.set(key, []);
            }
            tickerGroups.get(key).push(event);
        }
    }
    // Find ticker-based correlations (multi-domain)
    for (const [ticker, events] of tickerGroups) {
        if (events.length < 2)
            continue;
        const domains = [...new Set(events.map(e => e.domain))];
        if (domains.length < 2)
            continue; // Must have at least 2 domains
        // Check not already used
        const unusedEvents = events.filter(e => !usedEventIds.has(e.id));
        if (unusedEvents.length < 2)
            continue;
        correlations.push({
            events: unusedEvents,
            matchType: 'symbol',
            matchValue: ticker,
            domains,
        });
        unusedEvents.forEach(e => usedEventIds.add(e.id));
    }
    // Group by keyword overlap (at least 2 matching keywords)
    for (let i = 0; i < allEvents.length; i++) {
        for (let j = i + 1; j < allEvents.length; j++) {
            const a = allEvents[i];
            const b = allEvents[j];
            if (usedEventIds.has(a.id) || usedEventIds.has(b.id))
                continue;
            if (a.domain === b.domain)
                continue;
            const aKeywords = new Set(a.keywords?.map(k => k.toLowerCase()) || []);
            const bKeywords = b.keywords?.map(k => k.toLowerCase()) || [];
            const overlap = bKeywords.filter(k => aKeywords.has(k));
            if (overlap.length >= 2) {
                correlations.push({
                    events: [a, b],
                    matchType: 'topic',
                    matchValue: overlap.join(', '),
                    domains: [a.domain, b.domain],
                });
                usedEventIds.add(a.id);
                usedEventIds.add(b.id);
            }
        }
    }
    return correlations;
}
/**
 * Create a fused event from correlated events
 */
async function createFusedEvent(correlation) {
    const { events, matchType, matchValue, domains } = correlation;
    // Calculate severity: max + bonus for multi-domain
    const maxSeverity = Math.max(...events.map(e => e.severity || 0));
    const domainBonus = (domains.length - 1) * 10; // +10 per additional domain
    const finalSeverity = Math.min(100, maxSeverity + domainBonus);
    // Determine direction
    const directions = events.map(e => e.direction);
    const direction = directions.includes('negative') ? 'negative'
        : directions.includes('positive') ? 'positive'
            : 'mixed';
    // Merge entities
    const allEntities = [];
    const seenEntities = new Set();
    for (const event of events) {
        for (const entity of (event.entities || [])) {
            const key = `${entity.type}:${entity.value}`;
            if (!seenEntities.has(key)) {
                seenEntities.add(key);
                allEntities.push(entity);
            }
        }
    }
    // Merge keywords
    const allKeywords = [...new Set(events.flatMap(e => e.keywords || []))];
    // Build title
    const title = `${matchType === 'symbol' ? '📊' : '🔗'} ${matchValue}: ${domains.join('+')} 融合事件`;
    // Build rationale
    const rationale = `融合 ${events.length} 個事件 (${domains.join(', ')}), ` +
        `匹配類型: ${matchType}, 匹配值: ${matchValue}`;
    // Build impact hint
    const impactHint = finalSeverity >= 70
        ? '高度關注：多來源確認的重要事件'
        : finalSeverity >= 50
            ? '值得追蹤：跨領域相關事件'
            : '資訊整合：多來源關聯資料';
    const fusedEvent = {
        ts: new Date(),
        tenantId: events[0].tenantId || 'system',
        domain: 'fusion',
        eventType: 'fusion.market_impact.inferred',
        title,
        severity: finalSeverity,
        direction,
        sentiment: direction === 'positive' ? 'positive'
            : direction === 'negative' ? 'negative'
                : 'neutral',
        keywords: allKeywords.slice(0, 10),
        entities: allEntities.slice(0, 10),
        rationale,
        impactHint,
        rawRef: {
            sourceEventIds: events.map(e => e.id),
            matchType,
            matchValue,
            domains,
        },
    };
    await db.collection('fused_events').add({
        ...fusedEvent,
        ts: admin.firestore.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(`[Fusion Engine] Created fused event: ${title} (severity: ${finalSeverity})`);
    await (0, audit_service_1.logAudit)({
        tenantId: fusedEvent.tenantId,
        type: 'fusion_created',
        action: 'fusion_event_created',
        details: {
            severity: finalSeverity,
            domains,
            matchType,
            sourceCount: events.length,
        },
    });
}
//# sourceMappingURL=fusion-engine.service.js.map