/**
 * Fusion Engine Service
 * 
 * Correlates events from social + market + news within a sliding window
 * to produce unified fused_events with enhanced severity.
 * 
 * Per SPEC_PHASE6_5_PHASE7_CLOUD.md and fusion-policy.md
 */

import * as admin from 'firebase-admin';
import { FusedEvent, Entity } from '../types/social.types';
import { logAudit } from './audit.service';
import { incrementMetric } from './metrics.service';

const db = admin.firestore();

// Window for correlation (5-10 minutes)
const FUSION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Main fusion function - run every 5 minutes
 */
export async function runFusionEngine(): Promise<{
    processed: number;
    fused: number;
    errors: string[];
}> {
    console.log('[Fusion Engine] Starting fusion cycle...');
    const result = { processed: 0, fused: 0, errors: [] as string[] };

    try {
        const windowStart = new Date(Date.now() - FUSION_WINDOW_MS);

        // Fetch recent events from all domains
        const [socialEvents, marketEvents, newsEvents] = await Promise.all([
            getRecentEvents('social', windowStart),
            getRecentEvents('market', windowStart),
            getRecentEvents('news', windowStart),
        ]);

        result.processed = socialEvents.length + marketEvents.length + newsEvents.length;
        console.log(`[Fusion Engine] Found ${result.processed} events in window`);

        if (result.processed < 2) {
            return result; // Not enough to correlate
        }

        // Find correlations
        const correlations = findCorrelations(socialEvents, marketEvents, newsEvents);
        console.log(`[Fusion Engine] Found ${correlations.length} correlations`);

        // Create fused events
        for (const corr of correlations) {
            try {
                await createFusedEvent(corr);
                result.fused++;
            } catch (err: any) {
                console.error('[Fusion Engine] Failed to create fused event:', err);
                result.errors.push(err.message);
            }
        }

        await incrementMetric('system', 'fusion_runs_total', 1);
        await incrementMetric('system', 'fusion_events_created', result.fused);

        console.log('[Fusion Engine] Cycle complete:', result);
        return result;

    } catch (err: any) {
        console.error('[Fusion Engine] Fatal error:', err);
        result.errors.push(err.message);
        return result;
    }
}

/**
 * Get recent events from a domain
 */
async function getRecentEvents(domain: string, since: Date): Promise<FusedEvent[]> {
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
    })) as FusedEvent[];
}

interface Correlation {
    events: FusedEvent[];
    matchType: 'symbol' | 'topic' | 'location';
    matchValue: string;
    domains: string[];
}

/**
 * Find correlations between events
 */
function findCorrelations(
    social: FusedEvent[],
    market: FusedEvent[],
    news: FusedEvent[]
): Correlation[] {
    const correlations: Correlation[] = [];
    const allEvents = [...social, ...market, ...news];
    const usedEventIds = new Set<string>();

    // Group by ticker entities
    const tickerGroups = new Map<string, FusedEvent[]>();
    for (const event of allEvents) {
        const tickers = event.entities?.filter(e =>
            e.type === 'ticker' || e.type === 'fund' || e.type === 'future'
        ) || [];

        for (const ticker of tickers) {
            const key = ticker.value.toUpperCase();
            if (!tickerGroups.has(key)) {
                tickerGroups.set(key, []);
            }
            tickerGroups.get(key)!.push(event);
        }
    }

    // Find ticker-based correlations (multi-domain)
    for (const [ticker, events] of tickerGroups) {
        if (events.length < 2) continue;

        const domains = [...new Set(events.map(e => e.domain))];
        if (domains.length < 2) continue; // Must have at least 2 domains

        // Check not already used
        const unusedEvents = events.filter(e => !usedEventIds.has(e.id));
        if (unusedEvents.length < 2) continue;

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

            if (usedEventIds.has(a.id) || usedEventIds.has(b.id)) continue;
            if (a.domain === b.domain) continue;

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
async function createFusedEvent(correlation: Correlation): Promise<void> {
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
    const allEntities: Entity[] = [];
    const seenEntities = new Set<string>();
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

    const fusedEvent: Omit<FusedEvent, 'id'> = {
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

    console.log(`[Fusion Engine] Created fused event: ${title} (severity: ${finalSeverity})`);

    await logAudit({
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
