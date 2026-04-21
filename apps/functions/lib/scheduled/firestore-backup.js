"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledFirestoreBackup = void 0;
/**
 * Firestore Scheduled Backup
 *
 * Runs daily at 03:00 UTC (11:00 AM Taiwan time) to export
 * all Firestore collections to a GCS bucket for disaster recovery.
 *
 * Prerequisites:
 * 1. Create GCS bucket: gsutil mb gs://xxt-agent-firestore-backups
 * 2. Grant the Cloud Functions service account the
 *    `roles/datastore.importExportAdmin` role
 * 3. Grant the Cloud Functions service account the
 *    `roles/storage.admin` role on the backup bucket
 */
const v2_1 = require("firebase-functions/v2");
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const BACKUP_BUCKET = 'gs://xxt-agent-firestore-backups';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'xxt-agent';
/**
 * Scheduled Firestore backup - runs daily at 03:00 UTC
 */
exports.scheduledFirestoreBackup = functions
    .region('asia-east1')
    .pubsub.schedule('0 3 * * *')
    .timeZone('Asia/Taipei')
    .onRun(async () => {
    const client = new admin.firestore.v1.FirestoreAdminClient();
    const databaseName = client.databasePath(PROJECT_ID, '(default)');
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const outputUri = `${BACKUP_BUCKET}/backups/${timestamp}`;
    try {
        const [operation] = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: outputUri,
            collectionIds: [], // Empty = export all collections
        });
        v2_1.logger.info(JSON.stringify({
            severity: 'INFO',
            message: `Firestore backup started`,
            outputUri,
            operationName: operation.name,
        }));
        return operation;
    }
    catch (error) {
        v2_1.logger.error(JSON.stringify({
            severity: 'ERROR',
            message: 'Firestore backup failed',
            error: String(error),
        }));
        throw error;
    }
});
//# sourceMappingURL=firestore-backup.js.map