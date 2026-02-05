/**
 * Notion Mapper - Transforms normalized messages to Notion properties
 */
import { NotionProperties } from '../types';
import { NormalizedMessage } from '../models/job.model';
interface FieldMapping {
    title?: string;
    content?: string;
    tags?: string;
    date?: string;
    files?: string;
    location?: string;
    source?: string;
}
interface MapperOptions {
    fields: FieldMapping;
    defaults?: {
        tags?: string[];
        status?: string;
    };
}
/**
 * Map normalized message to Notion properties
 */
export declare function mapToNotionProperties(message: NormalizedMessage, options: MapperOptions, additionalTitle?: string): NotionProperties;
/**
 * Map image message to Notion properties
 */
export declare function mapImageToNotionProperties(message: NormalizedMessage, imageUrl: string, options: MapperOptions): NotionProperties;
/**
 * Map location message to Notion properties
 */
export declare function mapLocationToNotionProperties(message: NormalizedMessage, options: MapperOptions): NotionProperties;
/**
 * Extract tags from text (e.g., #todo, #idea)
 */
export declare function extractTags(text: string): string[];
export {};
//# sourceMappingURL=notion-mapper.service.d.ts.map