export type LogType = 'webhook_received' | 'job_enqueued' | 'worker_processing' | 'notion_written' | 'reply_sent' | 'error';
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
export declare function writeAuditLog(entry: AuditLogEntry): Promise<void>;
/**
 * Shortcut: Log webhook received
 */
export declare function logWebhookReceived(tenantId: string, eventCount: number, webhookEventId: string): Promise<void>;
/**
 * Shortcut: Log job enqueued
 */
export declare function logJobEnqueued(tenantId: string, jobId: string, messageType: string, webhookEventId: string): Promise<void>;
/**
 * Shortcut: Log Notion write result
 */
export declare function logNotionWritten(tenantId: string, jobId: string, success: boolean, pageId?: string, databaseId?: string, errorMessage?: string): Promise<void>;
/**
 * Shortcut: Log error
 */
export declare function logAuditError(tenantId: string, error: Error, context?: Record<string, unknown>): Promise<void>;
/**
 * Generic audit logging interface for services
 */
export declare function logAudit(entry: {
    tenantId: string;
    type: string;
    action: string;
    details?: Record<string, unknown>;
}): Promise<void>;
//# sourceMappingURL=audit.service.d.ts.map