// Alert condition evaluation engine

import type {
    AlertCondition,
    ConditionResult,
    InvestmentAlertRule,
    AlertTriggerEvent
} from '@/lib/types/alerts';
import type { RealTimeQuote } from '@/lib/hooks/useRealTimeQuotes';

interface EvaluationContext {
    quotes: Map<string, RealTimeQuote>;
    indicators?: Map<string, Record<string, number>>;  // symbol -> { rsi, macd, etc }
    sentiment?: Map<string, 'bullish' | 'bearish' | 'neutral'>;
    recentSignals?: string[]; // Signal IDs triggered recently
}

/**
 * Evaluate a single condition against current market data
 */
export function evaluateCondition(
    condition: AlertCondition,
    context: EvaluationContext
): ConditionResult {
    if (!condition.enabled) {
        return { conditionId: condition.id, met: false, message: 'Condition disabled' };
    }

    const symbol = condition.symbol;
    const quote = symbol ? context.quotes.get(symbol) : undefined;

    switch (condition.type) {
        case 'price_above':
            if (!quote || condition.value === undefined) {
                return { conditionId: condition.id, met: false, message: 'No quote data' };
            }
            return {
                conditionId: condition.id,
                met: quote.price > condition.value,
                currentValue: quote.price,
                threshold: condition.value,
                message: `${symbol}: $${quote.price.toFixed(2)} ${quote.price > condition.value ? '>' : '≤'} $${condition.value}`,
            };

        case 'price_below':
            if (!quote || condition.value === undefined) {
                return { conditionId: condition.id, met: false, message: 'No quote data' };
            }
            return {
                conditionId: condition.id,
                met: quote.price < condition.value,
                currentValue: quote.price,
                threshold: condition.value,
                message: `${symbol}: $${quote.price.toFixed(2)} ${quote.price < condition.value ? '<' : '≥'} $${condition.value}`,
            };

        case 'change_pct_above':
            if (!quote || condition.value === undefined) {
                return { conditionId: condition.id, met: false, message: 'No quote data' };
            }
            return {
                conditionId: condition.id,
                met: quote.changePct > condition.value,
                currentValue: quote.changePct,
                threshold: condition.value,
                message: `${symbol}: ${quote.changePct.toFixed(2)}% change`,
            };

        case 'change_pct_below':
            if (!quote || condition.value === undefined) {
                return { conditionId: condition.id, met: false, message: 'No quote data' };
            }
            return {
                conditionId: condition.id,
                met: quote.changePct < condition.value,
                currentValue: quote.changePct,
                threshold: condition.value,
                message: `${symbol}: ${quote.changePct.toFixed(2)}% change`,
            };

        case 'volume_above':
            if (!quote || condition.value === undefined) {
                return { conditionId: condition.id, met: false, message: 'No quote data' };
            }
            return {
                conditionId: condition.id,
                met: quote.volume > condition.value,
                currentValue: quote.volume,
                threshold: condition.value,
                message: `${symbol}: Volume ${quote.volume.toLocaleString()}`,
            };

        case 'rsi_above':
        case 'rsi_below': {
            const indicators = symbol ? context.indicators?.get(symbol) : undefined;
            const rsi = indicators?.rsi;
            if (rsi === undefined || condition.value === undefined) {
                return { conditionId: condition.id, met: false, message: 'No RSI data' };
            }
            const met = condition.type === 'rsi_above' ? rsi > condition.value : rsi < condition.value;
            return {
                conditionId: condition.id,
                met,
                currentValue: rsi,
                threshold: condition.value,
                message: `${symbol}: RSI ${rsi.toFixed(1)}`,
            };
        }

        case 'sentiment_bullish':
        case 'sentiment_bearish': {
            const sentiment = symbol ? context.sentiment?.get(symbol) : undefined;
            if (!sentiment) {
                return { conditionId: condition.id, met: false, message: 'No sentiment data' };
            }
            const targetSentiment = condition.type === 'sentiment_bullish' ? 'bullish' : 'bearish';
            return {
                conditionId: condition.id,
                met: sentiment === targetSentiment,
                message: `${symbol}: Sentiment is ${sentiment}`,
            };
        }

        default:
            return { conditionId: condition.id, met: false, message: 'Unknown condition type' };
    }
}

/**
 * Evaluate all conditions for a rule
 */
export function evaluateRule(
    rule: InvestmentAlertRule,
    context: EvaluationContext
): { shouldTrigger: boolean; results: ConditionResult[]; triggeredSymbol?: string } {
    if (!rule.enabled || rule.conditions.length === 0) {
        return { shouldTrigger: false, results: [] };
    }

    // Check cooldown
    if (rule.lastTriggeredAt) {
        const lastTrigger = new Date(rule.lastTriggeredAt).getTime();
        const cooldownMs = rule.cooldownSeconds * 1000;
        if (Date.now() - lastTrigger < cooldownMs) {
            return { shouldTrigger: false, results: [], };
        }
    }

    const results = rule.conditions.map(c => evaluateCondition(c, context));

    let shouldTrigger: boolean;
    if (rule.conditionOperator === 'AND') {
        shouldTrigger = results.every(r => r.met);
    } else {
        shouldTrigger = results.some(r => r.met);
    }

    // Find triggered symbol (first condition with a symbol)
    const triggeredSymbol = rule.conditions.find(c => c.symbol)?.symbol;

    return { shouldTrigger, results, triggeredSymbol };
}

/**
 * Create trigger event from evaluation results
 */
export function createTriggerEvent(
    rule: InvestmentAlertRule,
    results: ConditionResult[],
    symbol?: string
): AlertTriggerEvent {
    const metConditions = results.filter(r => r.met);
    const summary = metConditions.map(r => r.message).filter(Boolean).join('; ');

    return {
        ruleId: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        triggeredAt: new Date().toISOString(),
        conditions: results,
        symbol,
        summary: summary || 'Alert triggered',
    };
}
