/**
 * Validation utilities
 */

export function isValidTenantId(id: string): boolean {
    return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

export function isValidDatabaseId(id: string): boolean {
    // Notion IDs are 32 character hex strings (with or without dashes)
    const cleanId = id.replace(/-/g, '');
    return /^[a-f0-9]{32}$/i.test(cleanId);
}

export function sanitizeString(input: string, maxLength = 1000): string {
    if (typeof input !== 'string') return '';
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function validateRuleMatch(match: unknown): { valid: boolean; error?: string } {
    if (!match || typeof match !== 'object') {
        return { valid: false, error: 'Match is required' };
    }

    const m = match as Record<string, unknown>;

    const validTypes = ['prefix', 'keyword', 'contains', 'regex'];
    if (!validTypes.includes(m.type as string)) {
        return { valid: false, error: 'Invalid match type' };
    }

    if (!m.value || typeof m.value !== 'string') {
        return { valid: false, error: 'Match value is required' };
    }

    return { valid: true };
}

export function validateRuleRoute(route: unknown): { valid: boolean; error?: string } {
    if (!route || typeof route !== 'object') {
        return { valid: false, error: 'Route is required' };
    }

    const r = route as Record<string, unknown>;

    if (!r.databaseId || typeof r.databaseId !== 'string') {
        return { valid: false, error: 'Database ID is required' };
    }

    if (!isValidDatabaseId(r.databaseId as string)) {
        return { valid: false, error: 'Invalid database ID format' };
    }

    return { valid: true };
}
