/**
 * Dead Letter Queue (DLQ) Utilities
 *
 * Handles failed message management and replay functionality.
 */
export interface DLQMessage {
    id: string;
    originalTopic: string;
    data: unknown;
    error: string;
    timestamp: string;
    retryCount: number;
    metadata?: Record<string, string>;
}
export interface DLQConfig {
    projectId: string;
    dlqTopicSuffix?: string;
    maxRetries?: number;
}
/**
 * DLQ Manager for Pub/Sub
 */
export declare class DLQManager {
    private pubsub;
    private config;
    constructor(config: DLQConfig);
    /**
     * Get DLQ topic name for an original topic
     */
    getDLQTopicName(originalTopic: string): string;
    /**
     * Send failed message to DLQ
     */
    sendToDLQ(originalTopic: string, data: unknown, error: Error | string, retryCount?: number, metadata?: Record<string, string>): Promise<string>;
    /**
     * Replay messages from DLQ back to original topic
     */
    replayFromDLQ(originalTopic: string, options?: {
        limit?: number;
        filter?: (msg: DLQMessage) => boolean;
        onReplay?: (msg: DLQMessage) => void;
    }): Promise<{
        replayed: number;
        skipped: number;
        errors: number;
    }>;
    /**
     * Get DLQ message count (approximate)
     */
    getDLQStats(originalTopic: string): Promise<{
        topic: string;
        pendingMessages: number;
    }>;
}
export interface RetryableProcessorOptions {
    dlqManager: DLQManager;
    topicName: string;
    maxRetries?: number;
}
/**
 * Wrap a processor with automatic DLQ routing on failure
 */
export declare function withDLQ<T>(processor: (event: T) => Promise<void>, options: RetryableProcessorOptions): (event: T & {
    __retryCount?: number;
}) => Promise<void>;
/**
 * Replay CLI entry point
 * Usage: npm run replay:dlq -- --topic=news-collector --limit=10
 */
export declare function runReplayCLI(args: string[]): Promise<void>;
