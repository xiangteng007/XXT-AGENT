import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (sa) {
        initializeApp({ credential: cert(JSON.parse(sa)) });
    } else {
        initializeApp();
    }
}
const db = getFirestore();

export async function GET(req: NextRequest) {
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Get holdings
        const holdingsSnap = await db.collection(`users/${uid}/butler/finance/investments`).get();
        const holdings = holdingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Get recent trades
        const tradesSnap = await db.collection(`users/${uid}/butler/finance/investment_trades`)
            .orderBy('date', 'desc').limit(20).get();
        const trades = tradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Calculate totals
        const totalCost = holdings.reduce((sum: number, h: Record<string, unknown>) =>
            sum + ((h.shares as number) || 0) * ((h.avgCost as number) || 0), 0);
        const totalValue = holdings.reduce((sum: number, h: Record<string, unknown>) =>
            sum + ((h.marketValue as number) || (h.shares as number) * (h.avgCost as number) || 0), 0);

        // Asset allocation
        const typeMap: Record<string, number> = {};
        holdings.forEach((h: Record<string, unknown>) => {
            const type = (h.type as string) || 'other';
            const value = (h.marketValue as number) || ((h.shares as number) || 0) * ((h.avgCost as number) || 0);
            typeMap[type] = (typeMap[type] || 0) + value;
        });
        const typeLabels: Record<string, string> = {
            tw_stock: '台股', us_stock: '美股', etf: 'ETF',
            fund: '基金', bond: '債券', crypto: '加密貨幣',
        };
        const allocation = Object.entries(typeMap).map(([type, value]) => ({
            type, label: typeLabels[type] || type, value: Math.round(value),
            percentage: totalValue > 0 ? Math.round(value / totalValue * 100) : 0,
        }));

        return NextResponse.json({
            holdings,
            trades,
            totalCost: Math.round(totalCost),
            totalMarketValue: Math.round(totalValue),
            totalUnrealizedPnL: Math.round(totalValue - totalCost),
            returnRate: totalCost > 0 ? Math.round((totalValue - totalCost) / totalCost * 10000) / 100 : 0,
            holdingCount: holdings.length,
            allocation,
        });
    } catch (err) {
        console.error('[API] Investment error:', err);
        return NextResponse.json({ holdings: [], trades: [], holdingCount: 0, totalMarketValue: 0 });
    }
}
