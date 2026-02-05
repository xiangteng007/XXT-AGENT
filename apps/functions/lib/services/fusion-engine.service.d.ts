/**
 * Fusion Engine Service
 *
 * Correlates events from social + market + news within a sliding window
 * to produce unified fused_events with enhanced severity.
 *
 * Per SPEC_PHASE6_5_PHASE7_CLOUD.md and fusion-policy.md
 */
/**
 * Main fusion function - run every 5 minutes
 */
export declare function runFusionEngine(): Promise<{
    processed: number;
    fused: number;
    errors: string[];
}>;
//# sourceMappingURL=fusion-engine.service.d.ts.map