import { Timestamp } from 'firebase-admin/firestore';

/**
 * Job status enum
 */
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'dead' | 'ignored';

/**
 * Job document schema for Firestore
 */
export interface Job {
    id: string;
    tenantId: string;
    status: JobStatus;
    attempts: number;
    maxAttempts: number;

    // Event data
    webhookEventId: string;
    eventType: 'text' | 'image' | 'location' | 'sticker';

    // Payload (stored for retry)
    payload: JobPayload;

    // Routing result
    ruleId?: string;
    databaseId?: string;

    // Timing
    createdAt: Timestamp;
    updatedAt: Timestamp;
    processedAt?: Timestamp;

    // Error tracking
    lastError?: {
        code: string;
        message: string;
        timestamp: Timestamp;
    };

    // Retry metadata
    requeuedAt?: Timestamp;
    requeuedBy?: string;
    ignoredAt?: Timestamp;
    ignoredBy?: string;
}

/**
 * Job payload (stored in Firestore for retry)
 */
export interface JobPayload {
    // Tenant context
    tenantId: string;
    projectId: string;
    integrationId: string;
    notionIntegrationId: string;

    // Message content
    messageType: 'text' | 'image' | 'location' | 'sticker';
    text?: string;
    imageUrl?: string;
    location?: {
        title: string;
        address: string;
        latitude: number;
        longitude: number;
    };

    // LINE context
    lineUserId: string;
    replyToken?: string; // Note: expires after few seconds

    // Routing
    ruleId?: string;
    databaseId: string;
    properties?: Record<string, unknown>;
    tags?: string[];

    // Settings
    replyEnabled: boolean;
    replyMessages?: {
        success?: string;
        failure?: string;
    };
}

/**
 * Normalized message format (input to mapper)
 */
export interface NormalizedMessage {
    type: 'text' | 'image' | 'location' | 'sticker';
    text?: string;
    imageUrl?: string;
    location?: {
        title: string;
        address: string;
        latitude: number;
        longitude: number;
        googleMapsUrl: string;
    };
    metadata: {
        lineUserId: string;
        webhookEventId: string;
        timestamp: Date;
    };
}
