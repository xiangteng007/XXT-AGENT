/**
 * Financial Ledger API Route
 * 
 * Proxies requests to OpenClaw Gateway Accountant endpoints:
 * - GET /agents/accountant/report/summary
 * - GET /agents/accountant/ledger
 */
import { NextResponse } from 'next/server';
import { gatewayFetch } from '@/app/api/market/_gateway';

export async function GET() {
    const period = new Date().toISOString().slice(0, 7).replace('-', '');

    const [summaryRes, ledgerRes] = await Promise.allSettled([
        gatewayFetch(`/agents/accountant/report/summary?period=${period}`),
        gatewayFetch('/agents/accountant/ledger?limit=10'),
    ]);

    const summary = summaryRes.status === 'fulfilled' && summaryRes.value.ok
        ? await summaryRes.value.json()
        : null;

    const ledger = ledgerRes.status === 'fulfilled' && ledgerRes.value.ok
        ? await ledgerRes.value.json()
        : null;

    return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        summary,
        ledger: ledger?.entries ?? [],
    });
}
