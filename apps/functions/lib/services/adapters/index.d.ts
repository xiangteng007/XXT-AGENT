/**
 * Social Adapters Index
 *
 * Export all available social platform adapters.
 */
export { createRSSAdapter } from './rss.adapter';
export { createFacebookAdapter, createInstagramAdapter, createThreadsAdapter, } from './meta.adapter';
import { SocialAdapter } from '../../types/social.types';
/**
 * Adapter factory - creates adapter by platform name
 */
export declare function getAdapterByPlatform(platform: string): SocialAdapter | null;
/**
 * Get all available adapters
 */
export declare function getAllAdapters(): SocialAdapter[];
/**
 * Get list of supported platforms
 */
export declare function getSupportedPlatforms(): string[];
//# sourceMappingURL=index.d.ts.map