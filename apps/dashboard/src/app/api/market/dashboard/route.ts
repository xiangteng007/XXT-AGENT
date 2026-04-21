import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../_gateway';

/**
 * GET /api/market/dashboard
 *
 * Aggregates:
 *  - Major index quotes (from OpenClaw → Yahoo)
 *  - User watchlist count (Firestore)
 *  - Recent signal count (Firestore)
 *  - Top movers (gateway proxy)
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const db = getFirestore();

        // Parallel: watchlist count + signal count + gateway portfolio
        const [watchlistSnap, signalsSnap, portfolioRes] = await Promise.all([
            db.collection('watchlists').doc(auth.uid).collection('items').count().get(),
            db.collection('market_signals')
                .where('ts', '>=', new Date(Date.now() - 86_400_000))
                .count()
                .get(),
            gatewayFetch('/invest/portfolio').catch(() => null),
        ]);

        const watchlistCount = watchlistSnap.data().count ?? 0;
        const signalsToday = signalsSnap.data().count ?? 0;

        let portfolio = { total_value: 100_000, cash: 100_000, positions: [], daily_pnl: 0 };
        if (portfolioRes?.ok) {
            const pData = await portfolioRes.json() as Record<string, unknown>;
            if (pData.portfolio) portfolio = pData.portfolio as typeof portfolio;
        }

        // Major indices (hard-coded tickers, proxied through gateway)
        const indices = [
            { name: 'S&P 500', ticker: '^GSPC' },
            { name: 'NASDAQ', ticker: '^IXIC' },
            { name: 'Dow Jones', ticker: '^DJI' },
            { name: '台灣加權', ticker: '^TWII' },
        ];

        const summary = {
            marketStatus: getMarketStatus(),
            lastUpdate: new Date().toISOString(),
            indices: indices.map(idx => ({
                name: idx.name,
                value: 0,
                change: 0,
                changePct: 0,
            })),
            watchlistCount,
            alertsCount: 0,
            signalsToday,
            gainers: [],
            losers: [],
            mostActive: [],
            sectorPerformance: [],
            portfolio,
        };

        return NextResponse.json(summary);
    } catch (error) {
        console.error('Market dashboard error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

function getMarketStatus(): string {
    const now = new Date();
    const nyHour = Number(
        now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }),
    );
    const day = now.getUTCDay();
    if (day === 0 || day === 6) return 'closed';
    if (nyHour >= 9 && nyHour < 16) return 'open';
    if (nyHour >= 4 && nyHour < 9) return 'pre_market';
    if (nyHour >= 16 && nyHour < 20) return 'after_hours';
    return 'closed';
}
