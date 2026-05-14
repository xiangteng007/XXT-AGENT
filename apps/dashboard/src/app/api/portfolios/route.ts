/**
 * GET /api/portfolios — List all portfolios for the authenticated user
 * POST /api/portfolios — Create a new portfolio
 *
 * Firestore: users/{uid}/portfolios
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const snap = await db.collection(`users/${auth.uid}/portfolios`)
            .orderBy('createdAt', 'desc')
            .get();

        const portfolios = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                name: d.name || '',
                description: d.description || '',
                currency: d.currency || 'TWD',
                benchmark: d.benchmark || '',
                isDefault: d.isDefault ?? false,
                totalValue: d.totalValue ?? 0,
                totalCost: d.totalCost ?? 0,
                totalPnL: d.totalPnL ?? 0,
                totalPnLPct: d.totalPnLPct ?? 0,
                dailyPnL: d.dailyPnL ?? 0,
                dailyPnLPct: d.dailyPnLPct ?? 0,
                cashBalance: d.cashBalance ?? 0,
                positions: d.positions || [],
                riskMetrics: d.riskMetrics || {
                    dailyVolatility: 0,
                    annualizedVolatility: 0,
                    maxDrawdown: 0,
                    currentDrawdown: 0,
                    sharpeRatio: 0,
                    sortinoRatio: 0,
                    beta: 1,
                    alpha: 0,
                    herfindahlIndex: 0,
                    top5Weight: 0,
                    var95: 0,
                    var99: 0,
                },
                sectorAllocation: d.sectorAllocation || [],
                typeAllocation: d.typeAllocation || [],
                createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt || new Date().toISOString(),
                updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt || new Date().toISOString(),
            };
        });

        return NextResponse.json({ portfolios });
    } catch (error) {
        console.error('Portfolios GET error:', error);
        return NextResponse.json({ error: 'Failed to load portfolios', portfolios: [] }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const body = await req.json();

        // Check if this is the first portfolio (auto set as default)
        const existing = await db.collection(`users/${auth.uid}/portfolios`).limit(1).get();
        const isFirst = existing.empty;

        const now = new Date();
        const portfolio = {
            name: body.name || '新投資組合',
            description: body.description || '',
            currency: body.currency || 'TWD',
            benchmark: body.benchmark || '',
            isDefault: body.isDefault ?? isFirst,
            totalValue: body.cashBalance ?? 0,
            totalCost: 0,
            totalPnL: 0,
            totalPnLPct: 0,
            dailyPnL: 0,
            dailyPnLPct: 0,
            cashBalance: body.cashBalance ?? 0,
            positions: [],
            riskMetrics: {
                dailyVolatility: 0,
                annualizedVolatility: 0,
                maxDrawdown: 0,
                currentDrawdown: 0,
                sharpeRatio: 0,
                sortinoRatio: 0,
                beta: 1,
                alpha: 0,
                herfindahlIndex: 0,
                top5Weight: 0,
                var95: 0,
                var99: 0,
            },
            sectorAllocation: [],
            typeAllocation: [],
            createdAt: now,
            updatedAt: now,
        };

        const docRef = await db.collection(`users/${auth.uid}/portfolios`).add(portfolio);

        return NextResponse.json({
            portfolio: {
                id: docRef.id,
                ...portfolio,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Portfolios POST error:', error);
        return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
    }
}
