"use strict";
/**
 * Scheduled Firestore Backup
 *
 * CRON: 0 3 * * * (每日凌晨 3:00)
 *
 * 說明：
 * 自動匯出所有 Firestore 集合至指定的 GCS Bucket。
 * 僅保留 30 天，由 GCS Lifecycle (Terraform 負責) 自動清理。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledFirestoreBackup = void 0;
const firestore_1 = require("@google-cloud/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const client = new firestore_1.v1.FirestoreAdminClient();
// 從環境變數讀取 Bucket 名稱，或使用預設的 xxt-agent-backups
const BUCKET_NAME = process.env.BACKUP_BUCKET_NAME || "gs://xxt-agent-backups";
exports.scheduledFirestoreBackup = (0, scheduler_1.onSchedule)({
    schedule: "0 3 * * *",
    timeZone: "Asia/Taipei",
    timeoutSeconds: 540, // 備份可能需要較長時間
    memory: "256MiB",
    maxInstances: 1
}, async () => {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        v2_1.logger.error("No GCLOUD_PROJECT env var found");
        return;
    }
    const databaseName = client.databasePath(projectId, "(default)");
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const outputUriPrefix = `${BUCKET_NAME}/${timestamp}`;
        v2_1.logger.info(`Starting Firestore backup to ${outputUriPrefix}`);
        const [operation] = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: outputUriPrefix,
            // collectionIds: [] // 留空表示備份所有集合
        });
        v2_1.logger.info(`Export operation started: ${operation.name}`);
        // 可以選擇不等待完成，直接 return
        return;
    }
    catch (error) {
        v2_1.logger.error("Firestore backup failed:", error);
        throw new Error("Firestore export operation failed");
    }
});
//# sourceMappingURL=backup.js.map