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
    webhookEventId: string;
    eventType: 'text' | 'image' | 'location' | 'sticker';
    payload: JobPayload;
    ruleId?: string;
    databaseId?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    processedAt?: Timestamp;
    lastError?: {
        code: string;
        message: string;
        timestamp: Timestamp;
    };
    requeuedAt?: Timestamp;
    requeuedBy?: string;
    ignoredAt?: Timestamp;
    ignoredBy?: string;
}
/**
 * Job payload (stored in Firestore for retry)
 */
export interface JobPayload {
    tenantId: string;
    projectId: string;
    integrationId: string;
    notionIntegrationId: string;
    messageType: 'text' | 'image' | 'location' | 'sticker';
    text?: string;
    imageUrl?: string;
    location?: {
        title: string;
        address: string;
        latitude: number;
        longitude: number;
    };
    lineUserId: string;
    replyToken?: string;
    ruleId?: string;
    databaseId: string;
    properties?: Record<string, unknown>;
    tags?: string[];
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
//# sourceMappingURL=job.model.d.ts.map