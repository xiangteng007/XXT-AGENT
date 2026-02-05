"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeToNotion = writeToNotion;
exports.getDatabaseSchema = getDatabaseSchema;
exports.updateNotionPage = updateNotionPage;
const client_1 = require("@notionhq/client");
const secrets_service_1 = require("./secrets.service");
const retry_1 = require("../utils/retry");
// Cache Notion clients by integration ID
const clientCache = new Map();
const CLIENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
/**
 * Get Notion client for integration
 */
async function getNotionClient(integrationId) {
    const cached = clientCache.get(integrationId);
    if (cached && cached.expiry > Date.now()) {
        return cached.client;
    }
    const token = await (0, secrets_service_1.getNotionToken)(integrationId);
    const client = new client_1.Client({ auth: token });
    clientCache.set(integrationId, {
        client,
        expiry: Date.now() + CLIENT_CACHE_TTL,
    });
    return client;
}
/**
 * Write a new page to Notion database
 */
async function writeToNotion(params) {
    const { integrationId, databaseId, properties, content } = params;
    try {
        const notion = await getNotionClient(integrationId);
        // Build page creation request
        const pageRequest = {
            parent: { database_id: databaseId },
            properties: properties,
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
        const response = await (0, retry_1.retry)(async () => notion.pages.create(pageRequest), {
            maxRetries: 3,
            baseDelayMs: 1000,
            shouldRetry: retry_1.isRetryableError,
        });
        return {
            success: true,
            pageId: response.id,
            url: 'url' in response ? response.url : undefined,
        };
    }
    catch (error) {
        const err = error;
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
async function getDatabaseSchema(integrationId, databaseId) {
    try {
        const notion = await getNotionClient(integrationId);
        const response = await notion.databases.retrieve({
            database_id: databaseId,
        });
        const schema = {};
        for (const [name, property] of Object.entries(response.properties)) {
            const propType = property.type;
            schema[name] = { type: propType };
            // Extract options for select/multi_select/status
            if (propType === 'select' && 'select' in property && property.select?.options) {
                schema[name].options = property.select.options.map(o => o.name);
            }
            if (propType === 'multi_select' && 'multi_select' in property && property.multi_select?.options) {
                schema[name].options = property.multi_select.options.map(o => o.name);
            }
            if (propType === 'status' && 'status' in property && property.status?.options) {
                schema[name].options = property.status.options.map(o => o.name);
            }
        }
        return schema;
    }
    catch (error) {
        console.error('Get database schema error:', error);
        return null;
    }
}
/**
 * Update existing page
 */
async function updateNotionPage(integrationId, pageId, properties) {
    try {
        const notion = await getNotionClient(integrationId);
        const response = await (0, retry_1.retry)(async () => notion.pages.update({
            page_id: pageId,
            properties: properties,
        }), {
            maxRetries: 3,
            baseDelayMs: 1000,
            shouldRetry: retry_1.isRetryableError,
        });
        return {
            success: true,
            pageId: response.id,
        };
    }
    catch (error) {
        const err = error;
        return {
            success: false,
            error: err.message,
        };
    }
}
//# sourceMappingURL=notion.service.js.map