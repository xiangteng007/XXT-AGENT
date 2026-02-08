/**
 * GET /api/butler/finance - Monthly summary + spending categories
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const uid = auth.user.uid;

        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

        // Get month range
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endMonth = month === 12 ? 1 : month + 1;
        const endYear = month === 12 ? year + 1 : year;
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

        const txSnap = await db.collection(`users/${uid}/transactions`)
            .where('date', '>=', startDate)
            .where('date', '<', endDate)
            .orderBy('date', 'desc')
            .get();

        let totalExpense = 0;
        let totalIncome = 0;
        const categoryMap = new Map<string, number>();
        const recentTransactions: Array<Record<string, unknown>> = [];

        txSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.type === 'expense') {
                totalExpense += d.amount || 0;
                const cat = d.category || '未分類';
                categoryMap.set(cat, (categoryMap.get(cat) || 0) + (d.amount || 0));
            } else if (d.type === 'income') {
                totalIncome += d.amount || 0;
            }
            if (recentTransactions.length < 20) {
                recentTransactions.push({
                    id: doc.id,
                    type: d.type,
                    amount: d.amount,
                    category: d.category,
                    description: d.description,
                    date: d.date,
                });
            }
        });

        const categories = Array.from(categoryMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
            }));

        return NextResponse.json({
            year,
            month,
            totalExpense,
            totalIncome,
            netSavings: totalIncome - totalExpense,
            categories,
            recentTransactions,
            transactionCount: txSnap.size,
        });
    } catch (error) {
        console.error('Butler finance error:', error);
        return NextResponse.json({ error: 'Failed to load finance data' }, { status: 500 });
    }
}
