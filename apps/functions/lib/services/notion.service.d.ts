import { NotionProperties } from '../types';
interface WriteResult {
    success: boolean;
    pageId?: string;
    url?: string;
    error?: string;
    statusCode?: number;
}
interface WriteParams {
    integrationId: string;
    databaseId: string;
    properties: NotionProperties;
    content?: string;
}
/**
 * Write a new page to Notion database
 */
export declare function writeToNotion(params: WriteParams): Promise<WriteResult>;
/**
 * Get database schema
 */
export declare function getDatabaseSchema(integrationId: string, databaseId: string): Promise<Record<string, {
    type: string;
    options?: string[];
}> | null>;
/**
 * Update existing page
 */
export declare function updateNotionPage(integrationId: string, pageId: string, properties: NotionProperties): Promise<WriteResult>;
export {};
//# sourceMappingURL=notion.service.d.ts.map