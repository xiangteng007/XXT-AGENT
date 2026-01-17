/**
 * Time Series Repository
 *
 * Abstraction layer for time series data storage.
 * Supports multiple backends: Firestore (hot), BigQuery (cold).
 */
export interface OHLCVBar {
    symbol: string;
    timestamp: string;
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
    indicator: string;
    value: number;
    params?: Record<string, number>;
}
export interface TimeSeriesQuery {
    symbol: string;
    interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    from?: string;
    to?: string;
    limit?: number;
}
export interface TimeSeriesRepository {
    saveBar(bar: OHLCVBar): Promise<void>;
    saveBars(bars: OHLCVBar[]): Promise<void>;
    getBars(query: TimeSeriesQuery): Promise<OHLCVBar[]>;
    getLatestBar(symbol: string, interval: string): Promise<OHLCVBar | null>;
    saveIndicator(indicator: TechnicalIndicator): Promise<void>;
    getIndicators(symbol: string, indicator: string, query: TimeSeriesQuery): Promise<TechnicalIndicator[]>;
    aggregateToInterval(symbol: string, sourceInterval: string, targetInterval: string, from: string, to: string): Promise<OHLCVBar[]>;
}
interface BigQueryClient {
    query(options: {
        query: string;
        params?: Record<string, unknown>;
    }): Promise<[unknown[]]>;
    dataset(id: string): {
        table(id: string): {
            insert(rows: unknown[]): Promise<void>;
        };
    };
}
export declare function createTimeSeriesRepository(type?: 'memory' | 'bigquery', options?: {
    client?: BigQueryClient;
    projectId?: string;
    datasetId?: string;
}): TimeSeriesRepository;
export declare function getTimeSeriesRepository(): TimeSeriesRepository;
export declare function setTimeSeriesRepository(repo: TimeSeriesRepository): void;
export {};
