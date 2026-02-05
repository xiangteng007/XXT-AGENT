/**
 * Social Collector Worker Service
 *
 * Processes individual collect jobs from Cloud Tasks.
 * Fetches posts using adapters, enriches with Gemini, stores to Firestore.
 */
import { CollectJob } from '../types/social.types';
/**
 * Process a collect job
 */
export declare function processCollectJob(job: CollectJob): Promise<{
    fetched: number;
    inserted: number;
    deduplicated: number;
    errors: string[];
}>;
/**
 * Generate dedup hash
 */
export declare function generateDedupHash(title: string, url: string, createdAt: Date): string;
//# sourceMappingURL=social-collector.service.d.ts.map