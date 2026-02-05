/**
 * Market Streamer Service
 *
 * Fetches market quotes, detects anomalies, and generates signals/fused events.
 * Triggered by Cloud Scheduler every minute.
 */
/**
 * Main streamer function - run every minute
 */
export declare function runMarketStreamer(): Promise<{
    processed: number;
    signals: number;
    errors: string[];
}>;
//# sourceMappingURL=market-streamer.service.d.ts.map