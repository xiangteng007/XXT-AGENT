"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLineImage = uploadLineImage;
exports.getSignedUrl = getSignedUrl;
exports.deleteOldImages = deleteOldImages;
/**
 * Storage Service - Handle image uploads to Cloud Storage
 *
 * Images from LINE are downloaded and uploaded to Cloud Storage,
 * then the public URL is used in Notion.
 */
const storage_1 = require("@google-cloud/storage");
const line_service_1 = require("./line.service");
// Initialize Cloud Storage client
const storage = new storage_1.Storage();
// Get bucket name from environment
const getBucketName = () => {
    return process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT}-linebot-media`;
};
/**
 * Download image from LINE and upload to Cloud Storage
 * Returns the public URL
 */
async function uploadLineImage(messageId, integrationId, tenantId) {
    try {
        // Download from LINE
        const content = await (0, line_service_1.getMessageContent)(messageId, integrationId);
        if (!content) {
            console.error(`[Storage] Failed to download image ${messageId}`);
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
        console.log(`[Storage] Image uploaded: ${publicUrl}`);
        return publicUrl;
    }
    catch (error) {
        console.error('[Storage] Upload error:', error);
        return null;
    }
}
/**
 * Generate signed URL for private access (alternative to public)
 */
async function getSignedUrl(filename, expirationMinutes = 60) {
    try {
        const bucketName = getBucketName();
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filename);
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + expirationMinutes * 60 * 1000,
        });
        return url;
    }
    catch (error) {
        console.error('[Storage] Signed URL error:', error);
        return null;
    }
}
/**
 * Delete old images for cleanup
 */
async function deleteOldImages(tenantId, olderThanDays = 30) {
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
            const createdAt = new Date(metadata[0].timeCreated);
            if (createdAt < cutoffDate) {
                await file.delete();
                deletedCount++;
            }
        }
        console.log(`[Storage] Deleted ${deletedCount} old images for ${tenantId}`);
        return deletedCount;
    }
    catch (error) {
        console.error('[Storage] Cleanup error:', error);
        return 0;
    }
}
//# sourceMappingURL=storage.service.js.map