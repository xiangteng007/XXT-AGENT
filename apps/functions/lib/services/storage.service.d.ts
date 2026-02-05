/**
 * Download image from LINE and upload to Cloud Storage
 * Returns the public URL
 */
export declare function uploadLineImage(messageId: string, integrationId: string, tenantId: string): Promise<string | null>;
/**
 * Generate signed URL for private access (alternative to public)
 */
export declare function getSignedUrl(filename: string, expirationMinutes?: number): Promise<string | null>;
/**
 * Delete old images for cleanup
 */
export declare function deleteOldImages(tenantId: string, olderThanDays?: number): Promise<number>;
//# sourceMappingURL=storage.service.d.ts.map