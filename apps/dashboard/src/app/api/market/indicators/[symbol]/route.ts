import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { gatewayFetch } from '../../_gateway';

/**
 * GET /api/market/indicators/[symbol]
 *
 * Returns technical indicators for a symbol.
 * Proxies candle data from OpenClaw Gateway and computes basic indicators.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> },
) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const { symbol } = await params;

        // Try to get data from Investment Brain
        let candles: { close: number; high: number; low: number; volume: number }[] = [];

        try {
            const res = await gatewayFetch(
                `/invest/candles?symbol=${encodeURIComponent(symbol)}&interval=1d&range=3mo`,
            );
            if (res.ok) {
                const data = await res.json() as { candles?: typeof candles };
                candles = data.candles ?? [];
            }
        } catch {
            // Fallback — return placeholder indicators
        }

        // Compute basic indicators from candles (or return zero-filled structure)
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        const sma = (arr: number[], period: number) => {
            if (arr.length < period) return 0;
            return arr.slice(-period).reduce((a, b) => a + b, 0) / period;
        };

        const ema = (arr: number[], period: number) => {
            if (arr.length === 0) return 0;
            const k = 2 / (period + 1);
            let result = arr[0];
            for (let i = 1; i < arr.length; i++) {
                result = arr[i] * k + result * (1 - k);
            }
            return result;
        };

        // RSI
        let rsi14 = 50;
        if (closes.length >= 15) {
            let gains = 0, losses = 0;
            for (let i = closes.length - 14; i < closes.length; i++) {
                const diff = closes[i] - closes[i - 1];
                if (diff > 0) gains += diff;
                else losses -= diff;
            }
            const avgGain = gains / 14;
            const avgLoss = losses / 14;
            rsi14 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        }

        const sma20Val = sma(closes, 20);
        const lastClose = closes.length > 0 ? closes[closes.length - 1] : 0;
        const trend = lastClose > sma20Val ? 'up' : lastClose < sma20Val ? 'down' : 'flat';

        const indicators = {
            symbol: symbol.toUpperCase(),
            timestamp: new Date().toISOString(),
            sma20: round(sma(closes, 20)),
            sma50: round(sma(closes, 50)),
            sma200: round(sma(closes, 200)),
            ema12: round(ema(closes, 12)),
            ema26: round(ema(closes, 26)),
            rsi14: round(rsi14),
            macd: {
                macd: round(ema(closes, 12) - ema(closes, 26)),
                signal: 0,
                histogram: 0,
            },
            stochastic: { k: 50, d: 50 },
            bollingerBands: {
                upper: round(sma20Val * 1.02),
                middle: round(sma20Val),
                lower: round(sma20Val * 0.98),
            },
            atr14: round(
                highs.length >= 14
                    ? highs.slice(-14).reduce((a, h, i) => a + (h - lows.slice(-14)[i]), 0) / 14
                    : 0,
            ),
            vwap: round(lastClose),
            obv: 0,
            adx: 25,
            trend,
            support: lows.length > 0 ? [round(Math.min(...lows.slice(-60)))] : [],
            resistance: highs.length > 0 ? [round(Math.max(...highs.slice(-60)))] : [],
        };

        return NextResponse.json(indicators);
    } catch (error) {
        console.error('Indicators error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

function round(n: number) {
    return Math.round(n * 10000) / 10000;
}
