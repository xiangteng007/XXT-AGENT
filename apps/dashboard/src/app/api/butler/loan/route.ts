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
        const snapshot = await db.collection(`users/${uid}/butler/finance/loans`)
            .where('isActive', '==', true).get();
        const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const totalBalance = loans.reduce((sum: number, l: Record<string, unknown>) =>
            sum + ((l.remainingBalance as number) || 0), 0);
        const totalMonthly = loans.reduce((sum: number, l: Record<string, unknown>) =>
            sum + ((l.monthlyPayment as number) || 0), 0);
        const totalPrincipal = loans.reduce((sum: number, l: Record<string, unknown>) =>
            sum + ((l.principal as number) || 0), 0);

        return NextResponse.json({
            loans,
            totalRemainingBalance: Math.round(totalBalance),
            totalMonthlyPayment: Math.round(totalMonthly),
            totalOriginalPrincipal: Math.round(totalPrincipal),
            paidOffPercentage: totalPrincipal > 0 ? Math.round((totalPrincipal - totalBalance) / totalPrincipal * 100) : 0,
            loanCount: loans.length,
        });
    } catch (err) {
        console.error('[API] Loan error:', err);
        return NextResponse.json({ loans: [], loanCount: 0, totalRemainingBalance: 0 });
    }
}
