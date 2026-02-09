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

// Taiwan tax brackets (2025/2026)
const TAX_BRACKETS = [
    { min: 0, max: 590_000, rate: 0.05 },
    { min: 590_001, max: 1_330_000, rate: 0.12 },
    { min: 1_330_001, max: 2_660_000, rate: 0.20 },
    { min: 2_660_001, max: 4_980_000, rate: 0.30 },
    { min: 4_980_001, max: Infinity, rate: 0.40 },
];
const PROGRESSIVE_DIFF = [0, 41_300, 147_700, 413_700, 911_700];

export async function GET(req: NextRequest) {
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const year = new Date().getFullYear();
        const doc = await db.doc(`users/${uid}/butler/finance/tax/${year}`).get();
        const profile = doc.exists ? doc.data() : null;

        if (!profile) {
            return NextResponse.json({
                hasProfile: false,
                year,
                estimation: null,
                tips: ['請先在 LINE 輸入您的年收入來設定稅務資料'],
            });
        }

        // Quick estimation
        const grossIncome = (profile.annualSalary || 0) + (profile.businessIncome || 0)
            + (profile.investmentIncome || 0) + (profile.rentalIncome || 0) + (profile.otherIncome || 0);
        const exemptions = 97_000 * (1 + (profile.dependents || 0));
        const deductions = profile.filingStatus === 'married' ? 262_000 : 131_000;
        const salaryDeduction = Math.min(profile.annualSalary || 0, 218_000);
        const taxableIncome = Math.max(0, grossIncome - exemptions - deductions - salaryDeduction);

        let bracketIdx = 0;
        for (let i = TAX_BRACKETS.length - 1; i >= 0; i--) {
            if (taxableIncome > TAX_BRACKETS[i].min) { bracketIdx = i; break; }
        }
        const tax = Math.max(0, Math.round(taxableIncome * TAX_BRACKETS[bracketIdx].rate - PROGRESSIVE_DIFF[bracketIdx]));
        const effectiveRate = grossIncome > 0 ? Math.round(tax / grossIncome * 10000) / 100 : 0;

        return NextResponse.json({
            hasProfile: true,
            year,
            estimation: {
                grossIncome,
                taxableIncome,
                taxBracketRate: TAX_BRACKETS[bracketIdx].rate * 100,
                estimatedTax: tax,
                effectiveRate,
                deductionMethod: 'standard',
            },
            profile,
        });
    } catch (err) {
        console.error('[API] Tax error:', err);
        return NextResponse.json({ hasProfile: false, estimation: null });
    }
}
