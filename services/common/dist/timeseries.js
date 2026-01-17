"use strict";
/**
 * Time Series Repository
 *
 * Abstraction layer for time series data storage.
 * Supports multiple backends: Firestore (hot), BigQuery (cold).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTimeSeriesRepository = createTimeSeriesRepository;
exports.getTimeSeriesRepository = getTimeSeriesRepository;
exports.setTimeSeriesRepository = setTimeSeriesRepository;
// ============ In-Memory Implementation (Development) ============
class InMemoryTimeSeriesRepository {
    bars = new Map();
    indicators = new Map();
    getBarKey(symbol, interval) {
        return `${symbol}:${interval}`;
    }
    async saveBar(bar) {
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
    async saveBars(bars) {
        for (const bar of bars) {
            await this.saveBar(bar);
        }
    }
    async getBars(query) {
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
    async getLatestBar(symbol, interval) {
        const key = this.getBarKey(symbol, interval);
        const bars = this.bars.get(key) || [];
        return bars.length > 0 ? bars[bars.length - 1] : null;
    }
    async saveIndicator(indicator) {
        const key = `${indicator.symbol}:${indicator.indicator}`;
        const existing = this.indicators.get(key) || [];
        existing.push(indicator);
        existing.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (existing.length > 1000) {
            existing.splice(0, existing.length - 1000);
        }
        this.indicators.set(key, existing);
    }
    async getIndicators(symbol, indicator, query) {
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
    async aggregateToInterval(symbol, sourceInterval, targetInterval, from, to) {
        // Simplified aggregation - in production use proper time bucketing
        const sourceBars = await this.getBars({ symbol, interval: sourceInterval, from, to });
        // For now, just return source bars (proper aggregation would bucket by target interval)
        return sourceBars.map(b => ({ ...b, interval: targetInterval }));
    }
}
class BigQueryTimeSeriesRepository {
    client;
    datasetId;
    projectId;
    constructor(client, projectId, datasetId = 'xxt_timeseries') {
        this.client = client;
        this.projectId = projectId;
        this.datasetId = datasetId;
    }
    getTableName(interval) {
        return `ohlcv_${interval}`;
    }
    async saveBar(bar) {
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
    async saveBars(bars) {
        // Group by interval for batch insert
        const byInterval = new Map();
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
    async getBars(query) {
        const tableName = `${this.projectId}.${this.datasetId}.${this.getTableName(query.interval || '1m')}`;
        let sql = `SELECT * FROM \`${tableName}\` WHERE symbol = @symbol`;
        const params = { symbol: query.symbol };
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
        return rows.reverse();
    }
    async getLatestBar(symbol, interval) {
        const bars = await this.getBars({ symbol, interval: interval, limit: 1 });
        return bars.length > 0 ? bars[0] : null;
    }
    async saveIndicator(indicator) {
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
    async getIndicators(symbol, indicator, query) {
        const tableName = `${this.projectId}.${this.datasetId}.indicators`;
        let sql = `SELECT * FROM \`${tableName}\` WHERE symbol = @symbol AND indicator = @indicator`;
        const params = { symbol, indicator };
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
        return rows.reverse();
    }
    async aggregateToInterval(symbol, sourceInterval, targetInterval, from, to) {
        const sourceTable = `${this.projectId}.${this.datasetId}.${this.getTableName(sourceInterval)}`;
        // Use BigQuery time bucketing for aggregation
        const intervalMap = {
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
        return rows.map((row) => ({
            ...row,
            interval: targetInterval
        }));
    }
}
// ============ Factory ============
let repositoryInstance = null;
function createTimeSeriesRepository(type = 'memory', options) {
    if (type === 'bigquery' && options?.client && options?.projectId) {
        return new BigQueryTimeSeriesRepository(options.client, options.projectId, options.datasetId);
    }
    return new InMemoryTimeSeriesRepository();
}
function getTimeSeriesRepository() {
    if (!repositoryInstance) {
        repositoryInstance = createTimeSeriesRepository('memory');
    }
    return repositoryInstance;
}
function setTimeSeriesRepository(repo) {
    repositoryInstance = repo;
}
