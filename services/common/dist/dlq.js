"use strict";
/**
 * Dead Letter Queue (DLQ) Utilities
 *
 * Handles failed message management and replay functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DLQManager = void 0;
exports.withDLQ = withDLQ;
exports.runReplayCLI = runReplayCLI;
const pubsub_1 = require("@google-cloud/pubsub");
/**
 * DLQ Manager for Pub/Sub
 */
class DLQManager {
    pubsub;
    config;
    constructor(config) {
        this.config = {
            dlqTopicSuffix: '-dlq',
            maxRetries: 3,
            ...config
        };
        this.pubsub = new pubsub_1.PubSub({ projectId: config.projectId });
    }
    /**
     * Get DLQ topic name for an original topic
     */
    getDLQTopicName(originalTopic) {
        return `${originalTopic}${this.config.dlqTopicSuffix}`;
    }
    /**
     * Send failed message to DLQ
     */
    async sendToDLQ(originalTopic, data, error, retryCount = 0, metadata) {
        const dlqTopic = this.getDLQTopicName(originalTopic);
        const dlqMessage = {
            id: `dlq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            originalTopic,
            data,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
            retryCount,
            metadata
        };
        const messageBuffer = Buffer.from(JSON.stringify(dlqMessage));
        try {
            const messageId = await this.pubsub
                .topic(dlqTopic)
                .publishMessage({ data: messageBuffer });
            console.log(JSON.stringify({
                severity: 'WARN',
                message: 'Message sent to DLQ',
                originalTopic,
                dlqTopic,
                messageId,
                error: dlqMessage.error,
                retryCount
            }));
            return messageId;
        }
        catch (pubError) {
            console.error(JSON.stringify({
                severity: 'ERROR',
                message: 'Failed to send to DLQ',
                originalTopic,
                dlqTopic,
                error: String(pubError)
            }));
            throw pubError;
        }
    }
    /**
     * Replay messages from DLQ back to original topic
     */
    async replayFromDLQ(originalTopic, options = {}) {
        const dlqTopic = this.getDLQTopicName(originalTopic);
        const subscriptionName = `${dlqTopic}-replay-sub`;
        const stats = { replayed: 0, skipped: 0, errors: 0 };
        const limit = options.limit || 100;
        // Create temporary subscription for replay
        const subscription = this.pubsub.subscription(subscriptionName);
        let messageCount = 0;
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                subscription.removeListener('message', messageHandler);
                resolve(stats);
            }, 30000); // 30 second timeout
            const messageHandler = async (message) => {
                messageCount++;
                if (messageCount > limit) {
                    message.nack();
                    return;
                }
                try {
                    const dlqMessage = JSON.parse(message.data.toString());
                    // Apply filter if provided
                    if (options.filter && !options.filter(dlqMessage)) {
                        message.ack();
                        stats.skipped++;
                        return;
                    }
                    // Check max retries
                    if (dlqMessage.retryCount >= this.config.maxRetries) {
                        console.log(JSON.stringify({
                            severity: 'WARN',
                            message: 'Max retries exceeded, skipping',
                            id: dlqMessage.id,
                            retryCount: dlqMessage.retryCount
                        }));
                        message.ack();
                        stats.skipped++;
                        return;
                    }
                    // Republish to original topic
                    const originalData = typeof dlqMessage.data === 'object' && dlqMessage.data !== null
                        ? dlqMessage.data
                        : { data: dlqMessage.data };
                    const messageBuffer = Buffer.from(JSON.stringify({
                        ...originalData,
                        __retryCount: dlqMessage.retryCount + 1,
                        __replayedFrom: dlqTopic,
                        __replayedAt: new Date().toISOString()
                    }));
                    await this.pubsub.topic(originalTopic).publishMessage({ data: messageBuffer });
                    message.ack();
                    stats.replayed++;
                    options.onReplay?.(dlqMessage);
                }
                catch (error) {
                    console.error(JSON.stringify({
                        severity: 'ERROR',
                        message: 'Failed to replay message',
                        error: String(error)
                    }));
                    message.nack();
                    stats.errors++;
                }
                if (messageCount >= limit) {
                    clearTimeout(timeout);
                    subscription.removeListener('message', messageHandler);
                    resolve(stats);
                }
            };
            subscription.on('message', messageHandler);
        });
    }
    /**
     * Get DLQ message count (approximate)
     */
    async getDLQStats(originalTopic) {
        const dlqTopic = this.getDLQTopicName(originalTopic);
        // Note: This is a simplified implementation
        // In production, you'd use Monitoring API for accurate stats
        return {
            topic: dlqTopic,
            pendingMessages: 0 // Would need Monitoring API for real count
        };
    }
}
exports.DLQManager = DLQManager;
/**
 * Wrap a processor with automatic DLQ routing on failure
 */
function withDLQ(processor, options) {
    const { dlqManager, topicName, maxRetries = 3 } = options;
    return async (event) => {
        const retryCount = event.__retryCount || 0;
        try {
            await processor(event);
        }
        catch (error) {
            console.error(JSON.stringify({
                severity: 'ERROR',
                message: 'Processing failed',
                topicName,
                retryCount,
                error: String(error)
            }));
            if (retryCount >= maxRetries) {
                // Max retries exceeded, send to DLQ
                await dlqManager.sendToDLQ(topicName, event, error instanceof Error ? error : new Error(String(error)), retryCount);
            }
            else {
                // Re-throw to trigger Pub/Sub retry
                throw error;
            }
        }
    };
}
// ============ CLI Replay Tool ============
/**
 * Replay CLI entry point
 * Usage: npm run replay:dlq -- --topic=news-collector --limit=10
 */
async function runReplayCLI(args) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'xxt-agent';
    // Parse args
    const topic = args.find(a => a.startsWith('--topic='))?.split('=')[1];
    const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100', 10);
    if (!topic) {
        console.error('Usage: npm run replay:dlq -- --topic=<topic-name> [--limit=100]');
        process.exit(1);
    }
    const dlqManager = new DLQManager({ projectId });
    console.log(`Replaying from DLQ: ${dlqManager.getDLQTopicName(topic)}`);
    console.log(`Limit: ${limit}`);
    const stats = await dlqManager.replayFromDLQ(topic, {
        limit,
        onReplay: (msg) => console.log(`Replayed: ${msg.id}`)
    });
    console.log('\nReplay complete:');
    console.log(`  Replayed: ${stats.replayed}`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Errors: ${stats.errors}`);
}
// Run CLI if executed directly
if (require.main === module) {
    runReplayCLI(process.argv.slice(2)).catch(console.error);
}
