/**
 * Scheduled Firestore Backup
 *
 * CRON: 0 3 * * * (每日凌晨 3:00)
 *
 * 說明：
 * 自動匯出所有 Firestore 集合至指定的 GCS Bucket。
 * 僅保留 30 天，由 GCS Lifecycle (Terraform 負責) 自動清理。
 */
export declare const scheduledFirestoreBackup: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=backup.d.ts.map