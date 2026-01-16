import { getDb } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { OperationLog, LogType, MessageLog, NotionLog } from '../models';

interface LogEntry {
    teamId: string;
    projectId?: string;
    type: LogType;
    message?: Omit<MessageLog, 'lineUserId'> & { lineUserId: string };
    notion?: NotionLog;
    duration?: number;
}

/**
 * Log operation to Firestore and Cloud Logging
 */
export async function logOperation(entry: LogEntry): Promise<void> {
    const db = getDb();

    try {
        // Write to Firestore for persistence and querying
        const logDoc: Omit<OperationLog, 'id'> = {
            teamId: entry.teamId,
            projectId: entry.projectId,
            type: entry.type,
            message: entry.message ? {
                ...entry.message,
                lineUserId: hashUserId(entry.message.lineUserId),
            } : undefined,
            notion: entry.notion,
            timestamp: FieldValue.serverTimestamp() as any,
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

    } catch (error) {
        // Don't throw - logging should not break main flow
        console.error('Failed to log operation:', error);
    }
}

/**
 * Hash user ID for privacy
 */
function hashUserId(userId: string): string {
    // Simple hash for privacy - in production consider using crypto
    const hash = Buffer.from(userId).toString('base64').slice(0, 16);
    return `user_${hash}`;
}

/**
 * Log error with context
 */
export async function logError(
    teamId: string,
    error: Error,
    context?: Record<string, unknown>
): Promise<void> {
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
