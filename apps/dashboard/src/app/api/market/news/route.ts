import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../_gateway';

/**
 * GET /api/market/news
 *
 * Returns market news enriched with Triple Fusion sentiment analysis.
 * Sources:
 *  1. Firestore `market_news` collection
 *  2. Investment Brain's Triple Fusion context (optional enrichment)
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const db = getFirestore();
        const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50');

        // 1) Fetch from Firestore
        const snapshot = await db
            .collection('market_news')
            .orderBy('ts', 'desc')
            .limit(Math.min(limit, 100))
            .get();

        const news = snapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                ts: d.ts?.toDate?.()?.toISOString() ?? '',
                title: String(d.title ?? ''),
                source: String(d.source ?? ''),
                url: String(d.url ?? ''),
                relatedSymbols: Array.isArray(d.relatedSymbols) ? d.relatedSymbols : [],
                sentiment: String(d.sentiment ?? 'neutral'),
                severity: Number(d.severity ?? 0),
                // Triple Fusion enrichment fields
                tripleFusion: d.tripleFusion ?? null,
                summary: d.summary ?? null,
            };
        });

        // 2) Optionally enrich with latest Triple Fusion context
        let tripleFusionContext = null;
        try {
            const tfRes = await gatewayFetch('/invest/triple-fusion', {
                signal: AbortSignal.timeout(5_000),
            });
            if (tfRes.ok) {
                const tfData = await tfRes.json() as Record<string, unknown>;
                tripleFusionContext = {
                    marketRegime: tfData.market_regime ?? 'unknown',
                    overallSentiment: tfData.overall_sentiment ?? 'neutral',
                    keyThemes: Array.isArray(tfData.key_themes) ? tfData.key_themes : [],
                    lastUpdate: tfData.last_update ?? new Date().toISOString(),
                };
            }
        } catch {
            // Triple Fusion unavailable — that's OK
        }

        return NextResponse.json({
            news,
            tripleFusion: tripleFusionContext,
            meta: { count: news.length, limit },
        });
    } catch (error) {
        console.error('Market news error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
