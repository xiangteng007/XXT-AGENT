/**
 * AI Input Sanitizer (V3 Audit #9)
 *
 * Mitigates prompt injection attacks by sanitizing user inputs before
 * sending to LLM APIs. Detects and neutralizes common injection patterns.
 */
interface SanitizeResult {
    text: string;
    wasModified: boolean;
    flags: string[];
}
/**
 * Sanitize user input for LLM consumption.
 * Returns cleaned text and any detected injection flags.
 */
export declare function sanitizeForAI(input: string): SanitizeResult;
/**
 * Validate AI output for safe display to users.
 * Strips any potential data exfiltration or harmful content.
 */
export declare function sanitizeAIOutput(output: string): string;
export {};
//# sourceMappingURL=ai-sanitizer.d.ts.map