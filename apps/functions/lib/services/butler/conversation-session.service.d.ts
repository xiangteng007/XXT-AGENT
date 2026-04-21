/**
 * Butler Conversation Session Service
 *
 * Provides multi-turn conversation support by storing recent messages
 * in Firestore. Each user has a rolling window of recent messages
 * that are included as context for AI responses.
 */
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}
export interface ConversationSession {
    userId: string;
    messages: ConversationMessage[];
    lastActiveAt: string;
    sessionId: string;
    model?: string;
    activeAgent?: string;
}
/**
 * Get or create a conversation session for a user.
 * Automatically resets if session has been inactive for > SESSION_TTL_MS.
 */
export declare function getSession(userId: string): Promise<ConversationSession>;
/**
 * Append a message to the session and trim to MAX_HISTORY.
 */
export declare function appendMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<void>;
/**
 * Get previous messages formatted for AI context.
 * Returns the last N messages as a string array.
 */
export declare function getPreviousMessages(userId: string): Promise<string[]>;
/**
 * Clear the conversation session for a user.
 */
export declare function clearSession(userId: string): Promise<void>;
/**
 * Switch the active agent for a user's session
 */
export declare function switchAgent(userId: string, agentId: string): Promise<void>;
/**
 * Get session summary for display (e.g., in Butler admin panel)
 */
export declare function getSessionSummary(userId: string): Promise<{
    messageCount: number;
    sessionId: string;
    lastActiveAt: string;
    isExpired: boolean;
} | null>;
//# sourceMappingURL=conversation-session.service.d.ts.map