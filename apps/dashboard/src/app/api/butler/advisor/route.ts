import { NextRequest, NextResponse } from 'next/server';

/**
 * Advisor API route — generates AI financial advice
 * This is a lightweight proxy that triggers the financial-advisor.service
 * For now, returns a placeholder that gets populated by the service on demand
 */
export async function GET(req: NextRequest) {
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // The full advice generation happens server-side via Gemini + financial data
        // Dashboard will show cached advice or trigger via LINE bot
        return NextResponse.json({
            available: true,
            message: '請透過 LINE 輸入「理財建議」或「給我財務分析」來取得 AI 理財顧問報告',
            topics: [
                { id: 'comprehensive', label: '綜合報告', description: '投資+負債+稅務+退休全面分析' },
                { id: 'portfolio_review', label: '投資組合', description: '持倉分析、配置建議' },
                { id: 'debt_strategy', label: '負債策略', description: '還款優先序、轉貸建議' },
                { id: 'tax_optimization', label: '稅務優化', description: '節稅方案、扣除項建議' },
                { id: 'retirement_planning', label: '退休規劃', description: '退休金估算、儲蓄目標' },
                { id: 'emergency_fund', label: '緊急預備金', description: '預備金評估、建立計畫' },
            ],
        });
    } catch (err) {
        console.error('[API] Advisor error:', err);
        return NextResponse.json({ available: false });
    }
}
