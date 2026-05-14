/**
 * GET /api/portfolio/[id] — Get a single portfolio with full details
 * PATCH /api/portfolio/[id] — Update portfolio metadata
 * DELETE /api/portfolio/[id] — Delete a portfolio
 *
 * Firestore: users/{uid}/portfolios/{id}
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const { id } = await params;
        const db = getAdminDb();
        const doc = await db.collection(`users/${auth.uid}/portfolios`).doc(id).get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
        }

        const d = doc.data()!;
        const portfolio = {
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
            riskMetrics: d.riskMetrics || {},
            sectorAllocation: d.sectorAllocation || [],
            typeAllocation: d.typeAllocation || [],
            createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt,
            updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt,
        };

        return NextResponse.json({ portfolio });
    } catch (error) {
        console.error('Portfolio GET error:', error);
        return NextResponse.json({ error: 'Failed to load portfolio' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const { id } = await params;
        const db = getAdminDb();
        const body = await req.json();

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (body.name !== undefined) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.currency !== undefined) updates.currency = body.currency;
        if (body.benchmark !== undefined) updates.benchmark = body.benchmark;
        if (body.cashBalance !== undefined) updates.cashBalance = body.cashBalance;
        if (body.positions !== undefined) {
            updates.positions = body.positions;
            // Recalculate totals
            const positions = body.positions as Array<{ marketValue: number; avgCost: number; quantity: number }>;
            const totalMarketValue = positions.reduce((s, p) => s + (p.marketValue || 0), 0);
            const totalCost = positions.reduce((s, p) => s + (p.avgCost * p.quantity || 0), 0);
            updates.totalValue = totalMarketValue + (body.cashBalance ?? 0);
            updates.totalCost = totalCost;
            updates.totalPnL = totalMarketValue - totalCost;
            updates.totalPnLPct = totalCost > 0 ? ((totalMarketValue - totalCost) / totalCost) * 100 : 0;
        }

        await db.collection(`users/${auth.uid}/portfolios`).doc(id).update(updates);

        return NextResponse.json({ success: true, updated: Object.keys(updates) });
    } catch (error) {
        console.error('Portfolio PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update portfolio' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const { id } = await params;
        const db = getAdminDb();
        await db.collection(`users/${auth.uid}/portfolios`).doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Portfolio DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete portfolio' }, { status: 500 });
    }
}
