// Investment alert rule types for multi-condition triggering

export type AlertConditionType =
    | 'price_above'
    | 'price_below'
    | 'price_cross_above'
    | 'price_cross_below'
    | 'change_pct_above'
    | 'change_pct_below'
    | 'volume_above'
    | 'volume_spike'
    | 'rsi_above'
    | 'rsi_below'
    | 'macd_cross'
    | 'sentiment_bullish'
    | 'sentiment_bearish'
    | 'news_impact_high'
    | 'signal_triggered';

export type AlertOperator = 'AND' | 'OR';

export type AlertChannel = 'telegram' | 'line' | 'email' | 'push' | 'webhook';

export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AlertCondition {
    id: string;
    type: AlertConditionType;
    symbol?: string;           // Optional: specific symbol or 'any'
    value?: number;            // Threshold value
    timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    indicator?: string;        // For technical indicators
    enabled: boolean;
}

export interface AlertAction {
    channel: AlertChannel;
    template?: string;         // Custom message template
    webhookUrl?: string;       // For webhook channel
    cooldownSeconds?: number;  // Per-action cooldown
}

export interface InvestmentAlertRule {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    priority: AlertPriority;

    // Conditions
    conditions: AlertCondition[];
    conditionOperator: AlertOperator;

    // Actions
    actions: AlertAction[];

    // Throttling
    cooldownSeconds: number;      // Global cooldown for this rule
    maxTriggersPerDay?: number;

    // Metadata
    createdAt: string;
    updatedAt: string;
    lastTriggeredAt?: string;
    triggerCount: number;
}

// Condition evaluation result
export interface ConditionResult {
    conditionId: string;
    met: boolean;
    currentValue?: number;
    threshold?: number;
    message?: string;
}

// Alert trigger event
export interface AlertTriggerEvent {
    ruleId: string;
    ruleName: string;
    priority: AlertPriority;
    triggeredAt: string;
    conditions: ConditionResult[];
    symbol?: string;
    summary: string;
}

// Pre-defined condition templates
export const CONDITION_TEMPLATES: Record<string, Partial<AlertCondition>> = {
    price_drop_5pct: {
        type: 'change_pct_below',
        value: -5,
        timeframe: '1d',
    },
    price_surge_10pct: {
        type: 'change_pct_above',
        value: 10,
        timeframe: '1d',
    },
    volume_spike: {
        type: 'volume_spike',
        value: 200, // 200% of average
    },
    rsi_oversold: {
        type: 'rsi_below',
        value: 30,
        timeframe: '1d',
    },
    rsi_overbought: {
        type: 'rsi_above',
        value: 70,
        timeframe: '1d',
    },
};

// Helper to create a new condition
export function createCondition(
    type: AlertConditionType,
    overrides: Partial<AlertCondition> = {}
): AlertCondition {
    return {
        id: crypto.randomUUID(),
        type,
        enabled: true,
        ...overrides,
    };
}

// Helper to create a new rule
export function createAlertRule(
    name: string,
    overrides: Partial<InvestmentAlertRule> = {}
): InvestmentAlertRule {
    return {
        id: crypto.randomUUID(),
        name,
        enabled: true,
        priority: 'medium',
        conditions: [],
        conditionOperator: 'AND',
        actions: [{ channel: 'telegram' }],
        cooldownSeconds: 300,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}
