/**
 * AI Input Sanitizer (V3 Audit #9)
 * 
 * Mitigates prompt injection attacks by sanitizing user inputs before
 * sending to LLM APIs. Detects and neutralizes common injection patterns.
 */

import { logger } from 'firebase-functions/v2';

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
    /you\s+are\s+now\s+a\s+(different|new|evil)/i,
    /forget\s+(all\s+)?(your|previous)\s+(instructions|rules|training)/i,
    /system\s*:\s*/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /<<<\s*SYS/i,
    />>>/,
    /OVERRIDE\s+(ALL|SYSTEM|PREVIOUS)/i,
    /jailbreak/i,
    /DAN\s+(mode|prompt)/i,
    /act\s+as\s+(if\s+you\s+are\s+|an?\s+)(unrestricted|unfiltered|evil)/i,
    /reveal\s+(your|the)\s+(system|hidden|secret)\s+(prompt|instructions)/i,
    /output\s+(your|the)\s+(system|initial)\s+(prompt|message)/i,
    /disregard\s+(all|any|previous)/i,
];

// Max input length to prevent context stuffing
const MAX_INPUT_LENGTH = 4000;

interface SanitizeResult {
    text: string;
    wasModified: boolean;
    flags: string[];
}

/**
 * Sanitize user input for LLM consumption.
 * Returns cleaned text and any detected injection flags.
 */
export function sanitizeForAI(input: string): SanitizeResult {
    const flags: string[] = [];
    let text = input;

    // Truncate overly long inputs
    if (text.length > MAX_INPUT_LENGTH) {
        text = text.slice(0, MAX_INPUT_LENGTH);
        flags.push('truncated');
    }

    // Check for injection patterns
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            flags.push(`injection:${pattern.source.slice(0, 30)}`);
        }
    }

    // Strip potentially dangerous formatting
    text = text
        .replace(/\0/g, '')             // null bytes
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-9;]*m/g, '') // ANSI escape codes
        .replace(/\r/g, '');            // carriage returns

    if (flags.length > 0) {
        logger.warn('[AI Sanitizer] Suspicious input detected', { 
            flags, 
            inputLength: input.length 
        });
    }

    return {
        text,
        wasModified: flags.length > 0 || text !== input,
        flags,
    };
}

/**
 * Validate AI output for safe display to users.
 * Strips any potential data exfiltration or harmful content.
 */
export function sanitizeAIOutput(output: string): string {
    return output
        .replace(/```(system|internal|debug)[\s\S]*?```/g, '') // Strip system-tagged blocks
        .replace(/\[HIDDEN\][\s\S]*?\[\/HIDDEN\]/g, '')        // Strip hidden tags
        .replace(/(sk-[a-zA-Z0-9]{20,})/g, '[REDACTED]')       // Redact API keys
        .replace(/(AIza[a-zA-Z0-9_-]{35})/g, '[REDACTED]')     // Redact Google API keys
        .trim();
}
