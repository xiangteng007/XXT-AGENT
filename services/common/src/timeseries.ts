/**
 * Time Series Repository
 * 
 * Abstraction layer for time series data storage.
 * Supports multiple backends: Firestore (hot), BigQuery (cold).
 */

export interface OHLCVBar {
    symbol: string;
    timestamp: string;      // ISO8601
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number;
    trades?: number;
}

export interface TechnicalIndicator {
    symbol: string;
    timestamp: string;
    indicator: string;      // e.g., 'RSI_14', 'SMA_20', 'MACD'
    value: number;
    params?: Record<string, number>;
}

export interface TimeSeriesQuery {
    symbol: string;
    interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    from?: string;          // ISO8601
    to?: string;            // ISO8601
    limit?: number;
}

export interface TimeSeriesRepository {
    // OHLCV operations
    saveBar(bar: OHLCVBar): Promise<void>;
    saveBars(bars: OHLCVBar[]): Promise<void>;
    getBars(query: TimeSeriesQuery): Promise<OHLCVBar[]>;
    getLatestBar(symbol: string, interval: string): Promise<OHLCVBar | null>;

    // Indicator operations
    saveIndicator(indicator: TechnicalIndicator): Promise<void>;
    getIndicators(symbol: string, indicator: string, query: TimeSeriesQuery): Promise<TechnicalIndicator[]>;

    // Aggregation
    aggregateToInterval(symbol: string, sourceInterval: string, targetInterval: string, from: string, to: string): Promise<OHLCVBar[]>;
}

// ============ In-Memory Implementation (Development) ============

class InMemoryTimeSeriesRepository implements TimeSeriesRepository {
    private bars: Map<string, OHLCVBar[]> = new Map();
    private indicators: Map<string, TechnicalIndicator[]> = new Map();

    private getBarKey(symbol: string, interval: string): string {
        return `${symbol}:${interval}`;
    }

    async saveBar(bar: OHLCVBar): Promise<void> {
        const key = this.getBarKey(bar.symbol, bar.interval);
        const existing = this.bars.get(key) || [];
        existing.push(bar);
        // Keep sorted by timestamp
        existing.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        // Limit to last 1000 bars
        if (existing.length > 1000) {
            existing.splice(0, existing.length - 1000);
        }
        this.bars.set(key, existing);
    }

    async saveBars(bars: OHLCVBar[]): Promise<void> {
        for (const bar of bars) {
            await this.saveBar(bar);
        }
    }

    async getBars(query: TimeSeriesQuery): Promise<OHLCVBar[]> {
        const key = this.getBarKey(query.symbol, query.interval || '1m');
        let result = this.bars.get(key) || [];

        if (query.from) {
            const fromTime = new Date(query.from).getTime();
            result = result.filter(b => new Date(b.timestamp).getTime() >= fromTime);
        }

        if (query.to) {
            const toTime = new Date(query.to).getTime();
            result = result.filter(b => new Date(b.timestamp).getTime() <= toTime);
        }

        if (query.limit) {
            result = result.slice(-query.limit);
        }

        return result;
    }

    async getLatestBar(symbol: string, interval: string): Promise<OHLCVBar | null> {
        const key = this.getBarKey(symbol, interval);
        const bars = this.bars.get(key) || [];
        return bars.length > 0 ? bars[bars.length - 1] : null;
    }

    async saveIndicator(indicator: TechnicalIndicator): Promise<void> {
        const key = `${indicator.symbol}:${indicator.indicator}`;
        const existing = this.indicators.get(key) || [];
        existing.push(indicator);
        existing.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (existing.length > 1000) {
            existing.splice(0, existing.length - 1000);
        }
        this.indicators.set(key, existing);
    }

    async getIndicators(symbol: string, indicator: string, query: TimeSeriesQuery): Promise<TechnicalIndicator[]> {
        const key = `${symbol}:${indicator}`;
        let result = this.indicators.get(key) || [];

        if (query.from) {
            const fromTime = new Date(query.from).getTime();
            result = result.filter(i => new Date(i.timestamp).getTime() >= fromTime);
        }

        if (query.to) {
            const toTime = new Date(query.to).getTime();
            result = result.filter(i => new Date(i.timestamp).getTime() <= toTime);
        }

        if (query.limit) {
            result = result.slice(-query.limit);
        }

        return result;
    }

    async aggregateToInterval(
        symbol: string,
        sourceInterval: string,
        targetInterval: string,
        from: string,
        to: string
    ): Promise<OHLCVBar[]> {
        // Simplified aggregation - in production use proper time bucketing
        const sourceBars = await this.getBars({ symbol, interval: sourceInterval as OHLCVBar['interval'], from, to });

        // For now, just return source bars (proper aggregation would bucket by target interval)
        return sourceBars.map(b => ({ ...b, interval: targetInterval as OHLCVBar['interval'] }));
    }
}

// ============ BigQuery Implementation (Production) ============

interface BigQueryClient {
    query(options: { query: string; params?: Record<string, unknown> }): Promise<[unknown[]]>;
    dataset(id: string): {
        table(id: string): {
            insert(rows: unknown[]): Promise<void>;
        };
    };
}

class BigQueryTimeSeriesRepository implements TimeSeriesRepository {
    private client: BigQueryClient;
    private datasetId: string;
    private projectId: string;

    constructor(client: BigQueryClient, projectId: string, datasetId = 'xxt_timeseries') {
        this.client = client;
        this.projectId = projectId;
        this.datasetId = datasetId;
    }

    private getTableName(interval: string): string {
        return `ohlcv_${interval}`;
    }

    async saveBar(bar: OHLCVBar): Promise<void> {
        const table = this.client.dataset(this.datasetId).table(this.getTableName(bar.interval));
        await table.insert([{
            symbol: bar.symbol,
            timestamp: bar.timestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            vwap: bar.vwap || null,
            trades: bar.trades || null,
            inserted_at: new Date().toISOString()
        }]);
    }

    async saveBars(bars: OHLCVBar[]): Promise<void> {
        // Group by interval for batch insert
        const byInterval = new Map<string, OHLCVBar[]>();
        for (const bar of bars) {
            const existing = byInterval.get(bar.interval) || [];
            existing.push(bar);
            byInterval.set(bar.interval, existing);
        }

        for (const [interval, intervalBars] of byInterval) {
            const table = this.client.dataset(this.datasetId).table(this.getTableName(interval));
            await table.insert(intervalBars.map(bar => ({
                symbol: bar.symbol,
                timestamp: bar.timestamp,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume,
                vwap: bar.vwap || null,
                trades: bar.trades || null,
                inserted_at: new Date().toISOString()
            })));
        }
    }

    async getBars(query: TimeSeriesQuery): Promise<OHLCVBar[]> {
        const tableName = `${this.projectId}.${this.datasetId}.${this.getTableName(query.interval || '1m')}`;

        let sql = `SELECT * FROM \`${tableName}\` WHERE symbol = @symbol`;
        const params: Record<string, unknown> = { symbol: query.symbol };

        if (query.from) {
            sql += ' AND timestamp >= @from';
            params.from = query.from;
        }

        if (query.to) {
            sql += ' AND timestamp <= @to';
            params.to = query.to;
        }

        sql += ' ORDER BY timestamp DESC';

        if (query.limit) {
            sql += ` LIMIT ${query.limit}`;
        }

        const [rows] = await this.client.query({ query: sql, params });

        return (rows as OHLCVBar[]).reverse();
    }

    async getLatestBar(symbol: string, interval: string): Promise<OHLCVBar | null> {
        const bars = await this.getBars({ symbol, interval: interval as OHLCVBar['interval'], limit: 1 });
        return bars.length > 0 ? bars[0] : null;
    }

    async saveIndicator(indicator: TechnicalIndicator): Promise<void> {
        const table = this.client.dataset(this.datasetId).table('indicators');
        await table.insert([{
            symbol: indicator.symbol,
            timestamp: indicator.timestamp,
            indicator: indicator.indicator,
            value: indicator.value,
            params: JSON.stringify(indicator.params || {}),
            inserted_at: new Date().toISOString()
        }]);
    }

    async getIndicators(symbol: string, indicator: string, query: TimeSeriesQuery): Promise<TechnicalIndicator[]> {
        const tableName = `${this.projectId}.${this.datasetId}.indicators`;

        let sql = `SELECT * FROM \`${tableName}\` WHERE symbol = @symbol AND indicator = @indicator`;
        const params: Record<string, unknown> = { symbol, indicator };

        if (query.from) {
            sql += ' AND timestamp >= @from';
            params.from = query.from;
        }

        if (query.to) {
            sql += ' AND timestamp <= @to';
            params.to = query.to;
        }

        sql += ' ORDER BY timestamp DESC';

        if (query.limit) {
            sql += ` LIMIT ${query.limit}`;
        }

        const [rows] = await this.client.query({ query: sql, params });

        return (rows as TechnicalIndicator[]).reverse();
    }

    async aggregateToInterval(
        symbol: string,
        sourceInterval: string,
        targetInterval: string,
        from: string,
        to: string
    ): Promise<OHLCVBar[]> {
        const sourceTable = `${this.projectId}.${this.datasetId}.${this.getTableName(sourceInterval)}`;

        // Use BigQuery time bucketing for aggregation
        const intervalMap: Record<string, string> = {
            '5m': 'TIMESTAMP_TRUNC(timestamp, MINUTE, 5)',
            '15m': 'TIMESTAMP_TRUNC(timestamp, MINUTE, 15)',
            '1h': 'TIMESTAMP_TRUNC(timestamp, HOUR)',
            '4h': 'TIMESTAMP_TRUNC(timestamp, HOUR, 4)',
            '1d': 'TIMESTAMP_TRUNC(timestamp, DAY)'
        };

        const bucket = intervalMap[targetInterval] || 'timestamp';

        const sql = `
            SELECT 
                symbol,
                ${bucket} as timestamp,
                ARRAY_AGG(open ORDER BY timestamp LIMIT 1)[SAFE_OFFSET(0)] as open,
                MAX(high) as high,
                MIN(low) as low,
                ARRAY_AGG(close ORDER BY timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] as close,
                SUM(volume) as volume
            FROM \`${sourceTable}\`
            WHERE symbol = @symbol AND timestamp >= @from AND timestamp <= @to
            GROUP BY symbol, ${bucket}
            ORDER BY timestamp
        `;

        const [rows] = await this.client.query({ query: sql, params: { symbol, from, to } });

        return (rows as unknown[]).map((row: unknown) => ({
            ...(row as OHLCVBar),
            interval: targetInterval as OHLCVBar['interval']
        }));
    }
}

// ============ Factory ============

let repositoryInstance: TimeSeriesRepository | null = null;

export function createTimeSeriesRepository(
    type: 'memory' | 'bigquery' = 'memory',
    options?: { client?: BigQueryClient; projectId?: string; datasetId?: string }
): TimeSeriesRepository {
    if (type === 'bigquery' && options?.client && options?.projectId) {
        return new BigQueryTimeSeriesRepository(options.client, options.projectId, options.datasetId);
    }
    return new InMemoryTimeSeriesRepository();
}

export function getTimeSeriesRepository(): TimeSeriesRepository {
    if (!repositoryInstance) {
        repositoryInstance = createTimeSeriesRepository('memory');
    }
    return repositoryInstance;
}

export function setTimeSeriesRepository(repo: TimeSeriesRepository): void {
    repositoryInstance = repo;
}
