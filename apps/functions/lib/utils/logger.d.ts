import { LogType, MessageLog, NotionLog } from '../models';
interface LogEntry {
    teamId: string;
    projectId?: string;
    type: LogType;
    message?: Omit<MessageLog, 'lineUserId'> & {
        lineUserId: string;
    };
    notion?: NotionLog;
    duration?: number;
}
/**
 * Log operation to Firestore and Cloud Logging
 */
export declare function logOperation(entry: LogEntry): Promise<void>;
/**
 * Log error with context
 */
export declare function logError(teamId: string, error: Error, context?: Record<string, unknown>): Promise<void>;
export {};
//# sourceMappingURL=logger.d.ts.map