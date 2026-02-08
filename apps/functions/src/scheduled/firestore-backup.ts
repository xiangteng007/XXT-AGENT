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
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const BACKUP_BUCKET = 'gs://xxt-agent-firestore-backups';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'xxt-agent';

/**
 * Scheduled Firestore backup - runs daily at 03:00 UTC
 */
export const scheduledFirestoreBackup = functions
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

            console.log(JSON.stringify({
                severity: 'INFO',
                message: `Firestore backup started`,
                outputUri,
                operationName: operation.name,
            }));

            return operation;
        } catch (error) {
            console.error(JSON.stringify({
                severity: 'ERROR',
                message: 'Firestore backup failed',
                error: String(error),
            }));
            throw error;
        }
    });
