/**
 * Social Adapters Index
 * 
 * Export all available social platform adapters.
 */

export { createRSSAdapter } from './rss.adapter';
export { 
    createFacebookAdapter, 
    createInstagramAdapter, 
    createThreadsAdapter, 
} from './meta.adapter';

import { SocialAdapter } from '../../types/social.types';
import { createRSSAdapter } from './rss.adapter';
import { createFacebookAdapter, createInstagramAdapter, createThreadsAdapter } from './meta.adapter';

/**
 * Adapter factory - creates adapter by platform name
 */
export function getAdapterByPlatform(platform: string): SocialAdapter | null {
    switch (platform) {
        case 'rss':
            return createRSSAdapter();
        case 'facebook':
            return createFacebookAdapter();
        case 'instagram':
            return createInstagramAdapter();
        case 'threads':
            return createThreadsAdapter();
        default:
            return null;
    }
}

/**
 * Get all available adapters
 */
export function getAllAdapters(): SocialAdapter[] {
    return [
        createRSSAdapter(),
        createFacebookAdapter(),
        createInstagramAdapter(),
        createThreadsAdapter(),
    ];
}

/**
 * Get list of supported platforms
 */
export function getSupportedPlatforms(): string[] {
    return ['rss', 'facebook', 'instagram', 'threads'];
}
