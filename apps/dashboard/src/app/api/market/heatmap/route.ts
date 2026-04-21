import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/market/heatmap
 * Returns sector-level performance data.
 *
 * In the future this will proxy to a real data source.
 * Currently returns a curated snapshot so the heatmap page renders.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        // Curated sector data — will be replaced with real-time feed
        const sectors = [
            { id: 'tech', name: '科技', changePct: 1.23, marketCap: 14_800_000_000_000, volume: 980_000_000, stocks: [] },
            { id: 'health', name: '醫療保健', changePct: -0.45, marketCap: 7_200_000_000_000, volume: 420_000_000, stocks: [] },
            { id: 'finance', name: '金融', changePct: 0.78, marketCap: 8_900_000_000_000, volume: 510_000_000, stocks: [] },
            { id: 'consumer', name: '消費', changePct: 0.34, marketCap: 5_100_000_000_000, volume: 360_000_000, stocks: [] },
            { id: 'energy', name: '能源', changePct: -1.12, marketCap: 3_200_000_000_000, volume: 290_000_000, stocks: [] },
            { id: 'industrial', name: '工業', changePct: 0.56, marketCap: 4_700_000_000_000, volume: 340_000_000, stocks: [] },
            { id: 'materials', name: '原物料', changePct: -0.23, marketCap: 2_100_000_000_000, volume: 180_000_000, stocks: [] },
            { id: 'utilities', name: '公用事業', changePct: 0.12, marketCap: 1_600_000_000_000, volume: 120_000_000, stocks: [] },
            { id: 'realestate', name: '不動產', changePct: -0.67, marketCap: 1_400_000_000_000, volume: 95_000_000, stocks: [] },
            { id: 'comm', name: '通訊服務', changePct: 0.89, marketCap: 6_300_000_000_000, volume: 450_000_000, stocks: [] },
        ];

        return NextResponse.json({ sectors });
    } catch (error) {
        console.error('Heatmap error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
