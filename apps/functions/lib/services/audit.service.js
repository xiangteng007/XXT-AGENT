"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditLog = writeAuditLog;
exports.logWebhookReceived = logWebhookReceived;
exports.logJobEnqueued = logJobEnqueued;
exports.logNotionWritten = logNotionWritten;
exports.logAuditError = logAuditError;
exports.logAudit = logAudit;
/**
 * Audit Service - Structured logging with correlation
 */
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Write audit log entry
 */
async function writeAuditLog(entry) {
    const db = (0, firebase_1.getDb)();
    await db.collection('logs').add({
        type: entry.type,
        tenantId: entry.tenantId,
        message: entry.message,
        metadata: entry.metadata || {},
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
}
/**
 * Shortcut: Log webhook received
 */
async function logWebhookReceived(tenantId, eventCount, webhookEventId) {
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
async function logJobEnqueued(tenantId, jobId, messageType, webhookEventId) {
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
async function logNotionWritten(tenantId, jobId, success, pageId, databaseId, errorMessage) {
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
async function logAuditError(tenantId, error, context) {
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
async function logAudit(entry) {
    await writeAuditLog({
        type: entry.type || 'error',
        tenantId: entry.tenantId,
        message: entry.action,
        metadata: entry.details,
    });
}
//# sourceMappingURL=audit.service.js.map