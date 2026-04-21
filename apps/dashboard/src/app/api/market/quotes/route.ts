import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../_gateway';

/**
 * GET /api/market/quotes?symbols=AAPL,TSLA,^GSPC
 *
 * Proxies symbol quotes through the Investment Brain's market data.
 * Falls back to empty quotes on failure.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const symbolsParam = req.nextUrl.searchParams.get('symbols') ?? '';
        const symbols = symbolsParam
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        if (symbols.length === 0) {
            return NextResponse.json({ quotes: [] });
        }

        // Fetch quotes in parallel from Investment Brain (Yahoo proxy)
        const quotePromises = symbols.map(async (symbol) => {
            try {
                const res = await gatewayFetch(
                    `/invest/quote?symbol=${encodeURIComponent(symbol)}`,
                );
                if (res.ok) {
                    const data = await res.json() as Record<string, unknown>;
                    return {
                        symbol: String(data.symbol ?? symbol).toUpperCase(),
                        name: String(data.name ?? symbol),
                        type: 'stock' as const,
                        exchange: String(data.exchange ?? ''),
                        currency: 'USD',
                        lastPrice: Number(data.price ?? 0),
                        previousClose: Number(data.open ?? 0),
                        open: Number(data.open ?? 0),
                        high: Number(data.high ?? 0),
                        low: Number(data.low ?? 0),
                        change: Number(data.price ?? 0) - Number(data.open ?? 0),
                        changePct: Number(data.change_pct ?? 0),
                        volume: Number(data.volume ?? 0),
                        avgVolume: 0,
                        volumeRatio: 1,
                        high52w: 0,
                        low52w: 0,
                        lastTradeTime: String(data.timestamp ?? new Date().toISOString()),
                        marketStatus: 'open',
                    };
                }
            } catch {
                // Individual symbol failure — skip
            }
            // Return stub
            return {
                symbol: symbol.toUpperCase(),
                name: symbol,
                type: 'stock' as const,
                exchange: '',
                currency: 'USD',
                lastPrice: 0,
                previousClose: 0,
                open: 0,
                high: 0,
                low: 0,
                change: 0,
                changePct: 0,
                volume: 0,
                avgVolume: 0,
                volumeRatio: 1,
                high52w: 0,
                low52w: 0,
                lastTradeTime: new Date().toISOString(),
                marketStatus: 'closed',
            };
        });

        const quotes = await Promise.all(quotePromises);
        return NextResponse.json({ quotes });
    } catch (error) {
        console.error('Market quotes error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
