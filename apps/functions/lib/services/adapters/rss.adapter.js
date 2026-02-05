"use strict";
/**
 * RSS Adapter
 *
 * Fetches RSS/Atom feeds and normalizes to social posts.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRSSAdapter = createRSSAdapter;
const crypto = __importStar(require("crypto"));
const social_collector_service_1 = require("../social-collector.service");
/**
 * Create RSS adapter instance
 */
function createRSSAdapter() {
    return {
        platform: 'rss',
        async fetchDelta(cursor, config) {
            if (!config.feedUrl) {
                throw new Error('RSS adapter requires feedUrl in config');
            }
            // Fetch RSS feed
            const response = await fetch(config.feedUrl, {
                headers: {
                    'User-Agent': 'SENTENG-Social-Collector/1.0',
                },
            });
            if (!response.ok) {
                throw new Error(`RSS fetch failed: ${response.status}`);
            }
            const xmlText = await response.text();
            const items = parseRSS(xmlText);
            // Filter by cursor (sinceTs)
            const sinceDate = cursor.cursorValue
                ? new Date(cursor.cursorValue)
                : new Date(Date.now() - 24 * 60 * 60 * 1000);
            const newItems = items.filter(item => {
                const itemDate = new Date(item.pubDate);
                return itemDate > sinceDate;
            });
            // Sort by date ascending
            newItems.sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime());
            // Update cursor to latest item date
            const latestDate = newItems.length > 0
                ? new Date(newItems[newItems.length - 1].pubDate)
                : new Date();
            return {
                items: newItems,
                nextCursor: {
                    cursorType: 'sinceTs',
                    cursorValue: latestDate.toISOString(),
                },
            };
        },
        mapToNormalized(item, source) {
            const postId = item.guid || crypto.createHash('md5').update(item.link).digest('hex');
            const createdAt = new Date(item.pubDate);
            // Extract keywords from categories and title
            const keywords = [
                ...(item.categories || []),
                ...extractKeywordsFromText(item.title),
            ].slice(0, 10);
            // Basic sentiment (to be enriched by Gemini)
            const sentiment = detectBasicSentiment(item.title + ' ' + item.description);
            return {
                postKey: `rss:${source.id}:${postId}`,
                tenantId: source.tenantId,
                sourceId: source.id,
                platform: 'rss',
                postId,
                title: item.title,
                summary: stripHtml(item.description).slice(0, 500),
                createdAt,
                url: item.link,
                author: item.author || 'Unknown',
                engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
                keywords,
                sentiment,
                urgency: 1,
                severity: 10,
                entities: [],
                dedupHash: (0, social_collector_service_1.generateDedupHash)(item.title, item.link, createdAt),
                rawRef: item,
                insertedAt: new Date(),
            };
        },
    };
}
/**
 * Simple RSS parser (supports RSS 2.0 and Atom)
 */
function parseRSS(xml) {
    const items = [];
    // RSS 2.0 parsing
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
    for (const match of itemMatches) {
        const itemXml = match[1];
        items.push({
            title: extractTag(itemXml, 'title'),
            link: extractTag(itemXml, 'link'),
            description: extractTag(itemXml, 'description'),
            pubDate: extractTag(itemXml, 'pubDate') || new Date().toISOString(),
            author: extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator'),
            categories: extractAllTags(itemXml, 'category'),
            guid: extractTag(itemXml, 'guid'),
        });
    }
    // Atom parsing if no RSS items
    if (items.length === 0) {
        const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi);
        for (const match of entryMatches) {
            const entryXml = match[1];
            items.push({
                title: extractTag(entryXml, 'title'),
                link: extractAtomLink(entryXml),
                description: extractTag(entryXml, 'summary') || extractTag(entryXml, 'content'),
                pubDate: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated') || new Date().toISOString(),
                author: extractTag(entryXml, 'name'),
                categories: extractAllTags(entryXml, 'category'),
                guid: extractTag(entryXml, 'id'),
            });
        }
    }
    return items;
}
function extractTag(xml, tag) {
    const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
        || xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? match[1].trim() : '';
}
function extractAllTags(xml, tag) {
    const matches = xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'));
    return Array.from(matches).map(m => m[1].trim());
}
function extractAtomLink(xml) {
    const match = xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    return match ? match[1] : '';
}
function stripHtml(html) {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}
function extractKeywordsFromText(text) {
    // Extract hashtags and significant words
    const hashtags = text.match(/#[\w\u4e00-\u9fff]+/g) || [];
    return hashtags.map(h => h.slice(1));
}
function detectBasicSentiment(text) {
    const lowerText = text.toLowerCase();
    const negativeWords = ['災', '害', '死', '傷', '危', '險', '警', '急', '破壞', '意外', 'accident', 'disaster', 'emergency', 'critical'];
    const positiveWords = ['好', '讚', '成功', 'great', 'success', 'positive', 'win'];
    const negScore = negativeWords.filter(w => lowerText.includes(w)).length;
    const posScore = positiveWords.filter(w => lowerText.includes(w)).length;
    if (negScore > posScore)
        return 'negative';
    if (posScore > negScore)
        return 'positive';
    return 'neutral';
}
//# sourceMappingURL=rss.adapter.js.map