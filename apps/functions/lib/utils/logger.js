"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logOperation = logOperation;
exports.logError = logError;
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Log operation to Firestore and Cloud Logging
 */
async function logOperation(entry) {
    const db = (0, firebase_1.getDb)();
    try {
        // Write to Firestore for persistence and querying
        const logDoc = {
            teamId: entry.teamId,
            projectId: entry.projectId,
            type: entry.type,
            message: entry.message ? {
                ...entry.message,
                lineUserId: hashUserId(entry.message.lineUserId),
            } : undefined,
            notion: entry.notion,
            timestamp: firestore_1.FieldValue.serverTimestamp(),
            duration: entry.duration,
        };
        await db.collection('logs').add(logDoc);
        // Structured logging for Cloud Logging
        const severity = entry.type === 'error' ? 'ERROR' : 'INFO';
        console.log(JSON.stringify({
            severity,
            message: `[${entry.type}] ${entry.projectId || entry.teamId}`,
            teamId: entry.teamId,
            projectId: entry.projectId,
            type: entry.type,
            notionStatus: entry.notion?.status,
            duration: entry.duration,
        }));
    }
    catch (error) {
        // Don't throw - logging should not break main flow
        console.error('Failed to log operation:', error);
    }
}
/**
 * Hash user ID for privacy
 */
function hashUserId(userId) {
    // Simple hash for privacy - in production consider using crypto
    const hash = Buffer.from(userId).toString('base64').slice(0, 16);
    return `user_${hash}`;
}
/**
 * Log error with context
 */
async function logError(teamId, error, context) {
    console.error(JSON.stringify({
        severity: 'ERROR',
        message: error.message,
        stack: error.stack,
        teamId,
        ...context,
    }));
    await logOperation({
        teamId,
        type: 'error',
        notion: {
            databaseId: '',
            status: 'failed',
            errorMessage: error.message,
        },
    });
}
//# sourceMappingURL=logger.js.map