import { Client } from '@notionhq/client';
import { getNotionToken } from './secrets.service';
import { retry, isRetryableError } from '../utils/retry';
import { NotionProperties } from '../types';

// Type definition for select option
interface SelectOption {
    name: string;
    id?: string;
    color?: string;
}

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
    content?: string; // Optional body content
}

// Cache Notion clients by integration ID
const clientCache = new Map<string, { client: Client; expiry: number }>();
const CLIENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get Notion client for integration
 */
async function getNotionClient(integrationId: string): Promise<Client> {
    const cached = clientCache.get(integrationId);
    if (cached && cached.expiry > Date.now()) {
        return cached.client;
    }

    const token = await getNotionToken(integrationId);
    const client = new Client({ auth: token });

    clientCache.set(integrationId, {
        client,
        expiry: Date.now() + CLIENT_CACHE_TTL,
    });

    return client;
}

/**
 * Write a new page to Notion database
 */
export async function writeToNotion(params: WriteParams): Promise<WriteResult> {
    const { integrationId, databaseId, properties, content } = params;

    try {
        const notion = await getNotionClient(integrationId);

        // Build page creation request
        const pageRequest: Parameters<typeof notion.pages.create>[0] = {
            parent: { database_id: databaseId },
            properties: properties as any, // Type assertion for flexibility
        };

        // Add content blocks if provided
        if (content) {
            pageRequest.children = [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ type: 'text', text: { content } }],
                    },
                },
            ];
        }

        // Execute with retry for rate limits
        const response = await retry(
            async () => notion.pages.create(pageRequest),
            {
                maxRetries: 3,
                baseDelayMs: 1000,
                shouldRetry: isRetryableError,
            }
        );

        return {
            success: true,
            pageId: response.id,
            url: (response as any).url,
        };

    } catch (error: unknown) {
        const err = error as Error & { status?: number; code?: string };
        console.error('Notion write error:', {
            status: err.status,
            code: err.code,
            message: err.message,
        });

        return {
            success: false,
            error: err.message || 'Unknown error',
            statusCode: err.status,
        };
    }
}

/**
 * Get database schema
 */
export async function getDatabaseSchema(
    integrationId: string,
    databaseId: string
): Promise<Record<string, { type: string; options?: string[] }> | null> {
    try {
        const notion = await getNotionClient(integrationId);

        const response = await notion.databases.retrieve({
            database_id: databaseId,
        });

        const schema: Record<string, { type: string; options?: string[] }> = {};

        for (const [name, property] of Object.entries(response.properties)) {
            const propType = property.type;
            schema[name] = { type: propType };

            // Extract options for select/multi_select/status
            if (propType === 'select' && 'select' in property && property.select?.options) {
                schema[name].options = (property.select.options as SelectOption[]).map(o => o.name);
            }
            if (propType === 'multi_select' && 'multi_select' in property && property.multi_select?.options) {
                schema[name].options = (property.multi_select.options as SelectOption[]).map(o => o.name);
            }
            if (propType === 'status' && 'status' in property && property.status?.options) {
                schema[name].options = (property.status.options as SelectOption[]).map(o => o.name);
            }
        }

        return schema;

    } catch (error) {
        console.error('Get database schema error:', error);
        return null;
    }
}

/**
 * Update existing page
 */
export async function updateNotionPage(
    integrationId: string,
    pageId: string,
    properties: NotionProperties
): Promise<WriteResult> {
    try {
        const notion = await getNotionClient(integrationId);

        const response = await retry(
            async () => notion.pages.update({
                page_id: pageId,
                properties: properties as any,
            }),
            {
                maxRetries: 3,
                baseDelayMs: 1000,
                shouldRetry: isRetryableError,
            }
        );

        return {
            success: true,
            pageId: response.id,
        };

    } catch (error: unknown) {
        const err = error as Error;
        return {
            success: false,
            error: err.message,
        };
    }
}
