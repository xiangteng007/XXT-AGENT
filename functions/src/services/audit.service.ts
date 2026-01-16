/**
 * Audit Service - Structured logging with correlation
 */
import { getDb } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export type LogType =
    | 'webhook_received'
    | 'job_enqueued'
    | 'worker_processing'
    | 'notion_written'
    | 'reply_sent'
    | 'error';

export interface AuditLogEntry {
    type: LogType;
    tenantId: string;
    message: string;
    metadata?: {
        webhookEventId?: string;
        jobId?: string;
        ruleId?: string;
        databaseId?: string;
        pageId?: string;
        errorCode?: string;
        duration?: number;
        [key: string]: unknown;
    };
}

/**
 * Write audit log entry
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
    const db = getDb();

    await db.collection('logs').add({
        type: entry.type,
        tenantId: entry.tenantId,
        message: entry.message,
        metadata: entry.metadata || {},
        timestamp: FieldValue.serverTimestamp(),
    });
}

/**
 * Shortcut: Log webhook received
 */
export async function logWebhookReceived(
    tenantId: string,
    eventCount: number,
    webhookEventId: string
): Promise<void> {
    await writeAuditLog({
        type: 'webhook_received',
        tenantId,
        message: `Received ${eventCount} event(s)`,
        metadata: { webhookEventId },
    });
}

/**
 * Shortcut: Log job enqueued
 */
export async function logJobEnqueued(
    tenantId: string,
    jobId: string,
    messageType: string,
    webhookEventId: string
): Promise<void> {
    await writeAuditLog({
        type: 'job_enqueued',
        tenantId,
        message: `Job enqueued: ${messageType}`,
        metadata: { jobId, webhookEventId },
    });
}

/**
 * Shortcut: Log Notion write result
 */
export async function logNotionWritten(
    tenantId: string,
    jobId: string,
    success: boolean,
    pageId?: string,
    databaseId?: string,
    errorMessage?: string
): Promise<void> {
    await writeAuditLog({
        type: success ? 'notion_written' : 'error',
        tenantId,
        message: success ? `Page created: ${pageId}` : `Notion write failed: ${errorMessage}`,
        metadata: { jobId, pageId, databaseId, errorCode: success ? undefined : 'NOTION_ERROR' },
    });
}

/**
 * Shortcut: Log error
 */
export async function logAuditError(
    tenantId: string,
    error: Error,
    context?: Record<string, unknown>
): Promise<void> {
    await writeAuditLog({
        type: 'error',
        tenantId,
        message: error.message?.substring(0, 500) || 'Unknown error',
        metadata: {
            errorCode: error.name || 'UNKNOWN',
            ...context,
        },
    });
}

/**
 * Generic audit logging interface for services
 */
export async function logAudit(entry: {
    tenantId: string;
    type: string;
    action: string;
    details?: Record<string, unknown>;
}): Promise<void> {
    await writeAuditLog({
        type: entry.type as LogType || 'error',
        tenantId: entry.tenantId,
        message: entry.action,
        metadata: entry.details as AuditLogEntry['metadata'],
    });
}
