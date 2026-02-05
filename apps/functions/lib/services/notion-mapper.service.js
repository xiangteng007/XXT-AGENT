"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToNotionProperties = mapToNotionProperties;
exports.mapImageToNotionProperties = mapImageToNotionProperties;
exports.mapLocationToNotionProperties = mapLocationToNotionProperties;
exports.extractTags = extractTags;
/**
 * Map normalized message to Notion properties
 */
function mapToNotionProperties(message, options, additionalTitle) {
    const { fields, defaults } = options;
    const properties = {};
    // Title (required)
    const titleText = buildTitle(message, additionalTitle);
    if (fields.title) {
        properties[fields.title] = {
            title: [{ text: { content: titleText } }],
        };
    }
    // Content (rich text)
    if (fields.content && message.text) {
        properties[fields.content] = {
            rich_text: [{ text: { content: message.text } }],
        };
    }
    // Date
    if (fields.date) {
        properties[fields.date] = {
            date: { start: message.metadata.timestamp.toISOString().split('T')[0] },
        };
    }
    // Tags (multi-select)
    if (fields.tags && defaults?.tags && defaults.tags.length > 0) {
        properties[fields.tags] = {
            multi_select: defaults.tags.map(tag => ({ name: tag })),
        };
    }
    // Source indicator
    if (fields.source) {
        properties[fields.source] = {
            select: { name: 'LINE' },
        };
    }
    return properties;
}
/**
 * Map image message to Notion properties
 */
function mapImageToNotionProperties(message, imageUrl, options) {
    const properties = mapToNotionProperties(message, options, '📷 圖片');
    // Add files property if specified
    if (options.fields.files && imageUrl) {
        properties[options.fields.files] = {
            files: [{
                    type: 'external',
                    name: 'LINE Image',
                    external: { url: imageUrl },
                }],
        };
    }
    return properties;
}
/**
 * Map location message to Notion properties
 */
function mapLocationToNotionProperties(message, options) {
    const location = message.location;
    const titleText = location ? `📍 ${location.title || '位置'}` : '📍 位置';
    const properties = mapToNotionProperties(message, options, titleText);
    // Add location content
    if (options.fields.content && location) {
        const locationText = [
            location.title,
            location.address,
            `座標: ${location.latitude}, ${location.longitude}`,
            location.googleMapsUrl ? `地圖: ${location.googleMapsUrl}` : null,
        ].filter(Boolean).join('\n');
        properties[options.fields.content] = {
            rich_text: [{ text: { content: locationText } }],
        };
    }
    // Add location as separate rich text field if specified
    if (options.fields.location && location) {
        properties[options.fields.location] = {
            rich_text: [{
                    text: {
                        content: `${location.address || ''}\n${location.googleMapsUrl || ''}`,
                    },
                }],
        };
    }
    return properties;
}
/**
 * Build title from message
 */
function buildTitle(message, prefix) {
    const timestamp = message.metadata.timestamp;
    const timeStr = timestamp.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
    });
    if (prefix) {
        return `${prefix} - ${timeStr}`;
    }
    if (message.type === 'text' && message.text) {
        // Use first 30 chars of text as title
        const preview = message.text.substring(0, 30);
        return message.text.length > 30 ? `${preview}...` : preview;
    }
    if (message.type === 'image') {
        return `📷 圖片 - ${timeStr}`;
    }
    if (message.type === 'location' && message.location) {
        return `📍 ${message.location.title || '位置'} - ${timeStr}`;
    }
    return `LINE 訊息 - ${timeStr}`;
}
/**
 * Extract tags from text (e.g., #todo, #idea)
 */
function extractTags(text) {
    const matches = text.match(/#[\w\u4e00-\u9fa5]+/g);
    if (!matches)
        return [];
    return matches.map(tag => tag.substring(1)); // Remove # prefix
}
//# sourceMappingURL=notion-mapper.service.js.map