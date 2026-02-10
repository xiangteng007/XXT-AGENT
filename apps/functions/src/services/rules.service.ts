import { logger } from 'firebase-functions/v2';
import { getDb } from '../config/firebase';
import { Rule, RuleMatcher, FieldMapping } from '../models';
import { NotionProperties } from '../types';

export interface MatchResult {
    ruleId: string;
    ruleName: string;
    databaseId: string;
    properties: NotionProperties;
    originalText: string;
    processedText: string;
}

/**
 * Process message text and match against rules
 */
export async function processMessage(
    text: string,
    projectId: string
): Promise<MatchResult | null> {
    const db = getDb();

    // Get all active rules for this project, sorted by priority
    const rulesSnapshot = await db
        .collectionGroup('rules')
        .where('projectId', '==', projectId)
        .where('isActive', '==', true)
        .orderBy('priority', 'asc')
        .get();

    for (const doc of rulesSnapshot.docs) {
        const rule = { id: doc.id, ...doc.data() } as Rule;

        if (matchRule(text, rule.matcher)) {
            // Process the text content
            let processedText = text;
            if (rule.action.removePattern) {
                processedText = removePattern(text, rule.matcher);
            }

            // Build Notion properties
            const properties = buildNotionProperties(
                processedText.trim(),
                rule.action.fieldMapping
            );

            return {
                ruleId: rule.id,
                ruleName: rule.name,
                databaseId: rule.action.databaseId,
                properties,
                originalText: text,
                processedText: processedText.trim(),
            };
        }
    }

    return null;
}

/**
 * Match text against a rule matcher
 */
function matchRule(text: string, matcher: RuleMatcher): boolean {
    const pattern = matcher.pattern;
    const flags = matcher.caseSensitive ? '' : 'i';

    switch (matcher.type) {
        case 'prefix':
            if (matcher.caseSensitive) {
                return text.startsWith(pattern);
            }
            return text.toLowerCase().startsWith(pattern.toLowerCase());

        case 'keyword':
            if (matcher.caseSensitive) {
                return text.includes(pattern);
            }
            return text.toLowerCase().includes(pattern.toLowerCase());

        case 'contains':
            // Same as keyword but explicit
            return text.toLowerCase().includes(pattern.toLowerCase());

        case 'regex':
            try {
                const regex = new RegExp(pattern, flags);
                return regex.test(text);
            } catch {
                logger.error('Invalid regex pattern:', pattern);
                return false;
            }

        default:
            return false;
    }
}

/**
 * Remove matched pattern from text
 */
function removePattern(text: string, matcher: RuleMatcher): string {
    const pattern = matcher.pattern;
    const flags = matcher.caseSensitive ? 'g' : 'gi';

    switch (matcher.type) {
        case 'prefix':
            if (text.toLowerCase().startsWith(pattern.toLowerCase())) {
                return text.slice(pattern.length);
            }
            return text;

        case 'keyword':
        case 'contains':
            return text.replace(new RegExp(escapeRegex(pattern), flags), '');

        case 'regex':
            try {
                return text.replace(new RegExp(pattern, flags), '');
            } catch {
                return text;
            }

        default:
            return text;
    }
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build Notion properties from field mapping
 */
function buildNotionProperties(
    content: string,
    fieldMapping: FieldMapping
): NotionProperties {
    const properties: NotionProperties = {};

    // Title field (required)
    if (fieldMapping.title) {
        properties[fieldMapping.title] = {
            title: [{ text: { content } }],
        };
    }

    // Date field (auto-fill with today)
    if (fieldMapping.date) {
        const today = new Date().toISOString().split('T')[0];
        properties[fieldMapping.date] = {
            date: { start: today },
        };
    }

    // Status field
    if (fieldMapping.status) {
        properties[fieldMapping.status] = {
            status: { name: fieldMapping.status },
        };
    }

    // Tags (multi-select)
    if (fieldMapping.tags && fieldMapping.tags.length > 0) {
        properties['Tags'] = {
            multi_select: fieldMapping.tags.map(tag => ({ name: tag })),
        };
    }

    // Custom fields
    if (fieldMapping.customFields) {
        for (const [key, value] of Object.entries(fieldMapping.customFields)) {
            if (typeof value === 'string') {
                properties[key] = {
                    rich_text: [{ text: { content: value } }],
                };
            } else if (typeof value === 'number') {
                properties[key] = {
                    number: value,
                };
            } else if (typeof value === 'boolean') {
                properties[key] = {
                    checkbox: value,
                };
            }
        }
    }

    return properties;
}

/**
 * Get all rules for a project
 */
export async function getRulesForProject(projectId: string): Promise<Rule[]> {
    const db = getDb();

    const snapshot = await db
        .collectionGroup('rules')
        .where('projectId', '==', projectId)
        .orderBy('priority', 'asc')
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })) as Rule[];
}
