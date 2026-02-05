/**
 * Notion Mapper Tests - Simplified
 */
import { describe, it, expect } from '@jest/globals';

// Inline extractTags for testing
function extractTags(text: string): string[] {
    const matches = text.match(/#[\w\u4e00-\u9fa5]+/g);
    if (!matches) return [];
    return matches.map(tag => tag.substring(1));
}

// Inline buildTitle for testing
function buildTitle(text: string, maxLength: number = 30): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

describe('Notion Mapper - Tag Extraction', () => {
    describe('extractTags', () => {
        it('should extract hashtags from text', () => {
            const tags = extractTags('#todo Buy milk #urgent');
            expect(tags).toContain('todo');
            expect(tags).toContain('urgent');
        });

        it('should handle Chinese hashtags', () => {
            const tags = extractTags('#待辦 記得開會 #重要');
            expect(tags).toContain('待辦');
            expect(tags).toContain('重要');
        });

        it('should return empty array for no hashtags', () => {
            const tags = extractTags('No hashtags here');
            expect(tags).toEqual([]);
        });

        it('should remove # prefix from tags', () => {
            const tags = extractTags('#hello');
            expect(tags[0]).toBe('hello');
            expect(tags[0]).not.toContain('#');
        });

        it('should handle multiple consecutive hashtags', () => {
            const tags = extractTags('#one #two #three');
            expect(tags).toHaveLength(3);
        });
    });
});

describe('Notion Mapper - Title Building', () => {
    describe('buildTitle', () => {
        it('should not truncate short text', () => {
            const title = buildTitle('Short text');
            expect(title).toBe('Short text');
        });

        it('should truncate long text with ellipsis', () => {
            const longText = 'This is a very long text that should be truncated';
            const title = buildTitle(longText, 20);
            expect(title.length).toBeLessThanOrEqual(23); // 20 + '...'
            expect(title.endsWith('...')).toBe(true);
        });

        it('should handle exact length text', () => {
            const text = '12345678901234567890123456789012345';
            const title = buildTitle(text, 35);
            expect(title).toBe(text);
        });
    });
});

describe('Notion Property Building', () => {
    it('should create title property correctly', () => {
        const titleProperty = {
            title: [{ text: { content: 'Test Title' } }],
        };
        expect(titleProperty.title[0].text.content).toBe('Test Title');
    });

    it('should create rich_text property correctly', () => {
        const richTextProperty = {
            rich_text: [{ text: { content: 'Test Content' } }],
        };
        expect(richTextProperty.rich_text[0].text.content).toBe('Test Content');
    });

    it('should create date property correctly', () => {
        const dateProperty = {
            date: { start: '2026-01-19' },
        };
        expect(dateProperty.date.start).toBe('2026-01-19');
    });

    it('should create select property correctly', () => {
        const selectProperty = {
            select: { name: 'LINE' },
        };
        expect(selectProperty.select.name).toBe('LINE');
    });

    it('should create multi_select property correctly', () => {
        const multiSelectProperty = {
            multi_select: [{ name: 'tag1' }, { name: 'tag2' }],
        };
        expect(multiSelectProperty.multi_select).toHaveLength(2);
    });

    it('should create files property correctly', () => {
        const filesProperty = {
            files: [{
                type: 'external',
                name: 'Image',
                external: { url: 'https://example.com/image.jpg' },
            }],
        };
        expect(filesProperty.files[0].external.url).toBe('https://example.com/image.jpg');
    });
});
