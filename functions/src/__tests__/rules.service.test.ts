/**
 * Rules Service Tests
 */
import { describe, it, expect } from '@jest/globals';

// Inline implementation for testing pattern matching logic
function matchRulePattern(text: string, type: string, pattern: string): boolean {
    switch (type) {
        case 'prefix':
            return text.startsWith(pattern);
        case 'keyword':
        case 'contains':
            return text.toLowerCase().includes(pattern.toLowerCase());
        case 'regex':
            try {
                const regex = new RegExp(pattern, 'i');
                return regex.test(text);
            } catch {
                return false;
            }
        default:
            return false;
    }
}

describe('Rules Service - Pattern Matching', () => {
    describe('prefix matching', () => {
        it('should match text starting with pattern', () => {
            expect(matchRulePattern('#todo Buy milk', 'prefix', '#todo')).toBe(true);
        });

        it('should not match when pattern is not at start', () => {
            expect(matchRulePattern('Hello #todo', 'prefix', '#todo')).toBe(false);
        });

        it('should handle empty text', () => {
            expect(matchRulePattern('', 'prefix', '#todo')).toBe(false);
        });
    });

    describe('keyword matching', () => {
        it('should match pattern anywhere in text', () => {
            expect(matchRulePattern('I need to #todo something', 'keyword', '#todo')).toBe(true);
        });

        it('should not match when pattern is absent', () => {
            expect(matchRulePattern('No keyword here', 'keyword', '#todo')).toBe(false);
        });

        it('should be case-insensitive', () => {
            expect(matchRulePattern('URGENT task', 'keyword', 'urgent')).toBe(true);
        });
    });

    describe('contains matching', () => {
        it('should match substring ignoring case', () => {
            expect(matchRulePattern('URGENT: fix bug', 'contains', 'urgent')).toBe(true);
        });

        it('should not match when substring absent', () => {
            expect(matchRulePattern('Normal message', 'contains', 'urgent')).toBe(false);
        });
    });

    describe('regex matching', () => {
        it('should match regex patterns', () => {
            expect(matchRulePattern('[BUG-123] Fix issue', 'regex', '\\[BUG-\\d+\\]')).toBe(true);
        });

        it('should not match when regex fails', () => {
            expect(matchRulePattern('No bug here', 'regex', '\\[BUG-\\d+\\]')).toBe(false);
        });

        it('should handle invalid regex gracefully', () => {
            expect(matchRulePattern('test', 'regex', '[invalid')).toBe(false);
        });
    });
});
