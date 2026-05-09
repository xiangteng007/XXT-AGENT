/**
 * Local Tool Parser Service
 *
 * Uses Ollama (local RTX 4080) to parse user intent and extract structured
 * tool call arguments — **without sending any data to cloud APIs**.
 *
 * This replaces Gemini Function Calling for all sensitive operations:
 *   - record_expense    → financial transactions
 *   - add_event         → personal schedule
 *   - record_weight     → personal health
 *   - record_fuel       → vehicle behavior
 *   - add_investment    → portfolio / trades
 *   - record_exercise   → health activity
 *   - record_sleep      → health data
 *   - get_schedule      → read today's schedule (local Firestore)
 *   - get_spending      → read monthly expenses (local Firestore)
 *   - get_portfolio     → read investment portfolio (local Firestore)
 *   - calculate_loan    → pure math, no PII
 *   - estimate_tax      → pure math, no PII
 *
 * Tools NOT handled here (cloud-side AI reasoning required):
 *   - get_financial_advice  → synthesized multi-domain analysis
 *
 * Privacy guarantee:
 *   If Ollama is offline, this function returns null and the caller should
 *   display an offline message — NOT fall back to Gemini. Sensitive data
 *   never leaves the local network.
 *
 * @module local-tool-parser.service
 */
/** Subset of tool names that are resolved locally (sensitive data) */
export type LocalToolName = 'record_expense' | 'record_weight' | 'record_exercise' | 'record_sleep' | 'add_event' | 'record_fuel' | 'add_investment' | 'get_schedule' | 'get_spending' | 'get_portfolio' | 'calculate_loan' | 'estimate_tax';
export interface LocalToolCall {
    name: LocalToolName;
    args: Record<string, unknown>;
}
/** Result from the local parser */
export interface LocalParseResult {
    toolCall: LocalToolCall | null;
    /** 'local' = parsed by Ollama, 'offline' = Ollama unavailable */
    source: 'local' | 'offline';
}
/**
 * Patterns that indicate sensitive personal data in the message.
 * Exported so inference-router.service.ts can use the same patterns
 * to ensure these messages are ALWAYS routed to local backend.
 */
export declare const SENSITIVE_TOOL_PATTERNS: RegExp[];
export declare function mightContainToolIntent(message: string): boolean;
/**
 * Attempt to parse a tool call from a user message using local Ollama.
 *
 * @returns `{ toolCall, source: 'local' }` if parsed successfully
 *          `{ toolCall: null, source: 'local' }` if no tool intent detected
 *          `{ toolCall: null, source: 'offline' }` if Ollama is unavailable
 */
export declare function parseLocalToolCall(message: string, agentId?: string): Promise<LocalParseResult>;
/**
 * Returns true if the given tool name should NEVER be sent to a cloud API.
 */
export declare function isSensitiveTool(toolName: string): boolean;
//# sourceMappingURL=local-tool-parser.service.d.ts.map