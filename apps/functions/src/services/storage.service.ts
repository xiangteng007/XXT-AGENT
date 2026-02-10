/**
 * Storage Service - Handle image uploads to Cloud Storage
 * 
 * Images from LINE are downloaded and uploaded to Cloud Storage,
 * then the public URL is used in Notion.
 */
import { logger } from 'firebase-functions/v2';
import { Storage } from '@google-cloud/storage';
import { getMessageContent } from './line.service';

// Initialize Cloud Storage client
const storage = new Storage();

// Get bucket name from environment
const getBucketName = (): string => {
    return process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT}-linebot-media`;
};

/**
 * Download image from LINE and upload to Cloud Storage
 * Returns the public URL
 */
export async function uploadLineImage(
    messageId: string,
    integrationId: string,
    tenantId: string
): Promise<string | null> {
    try {
        // Download from LINE
        const content = await getMessageContent(messageId, integrationId);
        if (!content) {
            logger.error(`[Storage] Failed to download image ${messageId}`);
            return null;
        }

        // Generate file path
        const timestamp = Date.now();
        const filename = `${tenantId}/${timestamp}-${messageId}.jpg`;
        const bucketName = getBucketName();

        // Upload to Cloud Storage
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filename);

        await file.save(content, {
            metadata: {
                contentType: 'image/jpeg',
                metadata: {
                    tenantId,
                    lineMessageId: messageId,
                    uploadedAt: new Date().toISOString(),
                },
            },
        });

        // Make public (or use signed URL for private)
        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
        logger.info(`[Storage] Image uploaded: ${publicUrl}`);

        return publicUrl;

    } catch (error) {
        logger.error('[Storage] Upload error:', error);
        return null;
    }
}

/**
 * Generate signed URL for private access (alternative to public)
 */
export async function getSignedUrl(
    filename: string,
    expirationMinutes = 60
): Promise<string | null> {
    try {
        const bucketName = getBucketName();
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filename);

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + expirationMinutes * 60 * 1000,
        });

        return url;

    } catch (error) {
        logger.error('[Storage] Signed URL error:', error);
        return null;
    }
}

/**
 * Delete old images for cleanup
 */
export async function deleteOldImages(
    tenantId: string,
    olderThanDays = 30
): Promise<number> {
    try {
        const bucketName = getBucketName();
        const bucket = storage.bucket(bucketName);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const [files] = await bucket.getFiles({
            prefix: `${tenantId}/`,
        });

        let deletedCount = 0;
        for (const file of files) {
            const metadata = await file.getMetadata();
            const createdAt = new Date(metadata[0].timeCreated as string);

            if (createdAt < cutoffDate) {
                await file.delete();
                deletedCount++;
            }
        }

        logger.info(`[Storage] Deleted ${deletedCount} old images for ${tenantId}`);
        return deletedCount;

    } catch (error) {
        logger.error('[Storage] Cleanup error:', error);
        return 0;
    }
}
