/**
 * Scheduled Firestore Backup
 *
 * CRON: 0 3 * * * (每日凌晨 3:00)
 *
 * 說明：
 * 自動匯出所有 Firestore 集合至指定的 GCS Bucket。
 * 僅保留 30 天，由 GCS Lifecycle (Terraform 負責) 自動清理。
 */

import { v1 } from "@google-cloud/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

const client = new v1.FirestoreAdminClient();

// 從環境變數讀取 Bucket 名稱，或使用預設的 xxt-agent-backups
const BUCKET_NAME = process.env.BACKUP_BUCKET_NAME || "gs://xxt-agent-backups";

export const scheduledFirestoreBackup = onSchedule(
    {
        schedule: "0 3 * * *",
        timeZone: "Asia/Taipei",
        timeoutSeconds: 540, // 備份可能需要較長時間
        memory: "256MiB",
        maxInstances: 1
    },
    async () => {
        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId) {
            logger.error("No GCLOUD_PROJECT env var found");
            return;
        }

        const databaseName = client.databasePath(projectId, "(default)");

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const outputUriPrefix = `${BUCKET_NAME}/${timestamp}`;

            logger.info(`Starting Firestore backup to ${outputUriPrefix}`);

            const [operation] = await client.exportDocuments({
                name: databaseName,
                outputUriPrefix: outputUriPrefix,
                // collectionIds: [] // 留空表示備份所有集合
            });

            logger.info(`Export operation started: ${operation.name}`);
            
            // 可以選擇不等待完成，直接 return
            return;
        } catch (error) {
            logger.error("Firestore backup failed:", error);
            throw new Error("Firestore export operation failed");
        }
    }
);
