/**
 * Butler Conversation Session Service
 * 
 * Provides multi-turn conversation support by storing recent messages
 * in Firestore. Each user has a rolling window of recent messages
 * that are included as context for AI responses.
 */

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const MAX_HISTORY = 10;        // Keep last N messages per user
const SESSION_TTL_MS = 30 * 60 * 1000;  // 30 min inactivity = new session

// ================================
// Types
// ================================

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;  // ISO
}

export interface ConversationSession {
    userId: string;
    messages: ConversationMessage[];
    lastActiveAt: string;
    sessionId: string;
    model?: string;
}

// ================================
// Session Management
// ================================

function sessionRef(userId: string) {
    return db.doc(`users/${userId}/butler/conversation`);
}

/**
 * Get or create a conversation session for a user.
 * Automatically resets if session has been inactive for > SESSION_TTL_MS.
 */
export async function getSession(userId: string): Promise<ConversationSession> {
    const doc = await sessionRef(userId).get();

    if (doc.exists) {
        const session = doc.data() as ConversationSession;
        const lastActive = new Date(session.lastActiveAt).getTime();
        const now = Date.now();

        // Check if session expired
        if (now - lastActive > SESSION_TTL_MS) {
            logger.info(`[Session] Expired for ${userId}, creating new session`);
            return createNewSession(userId);
        }

        return session;
    }

    return createNewSession(userId);
}

/**
 * Create a fresh conversation session
 */
async function createNewSession(userId: string): Promise<ConversationSession> {
    const session: ConversationSession = {
        userId,
        messages: [],
        lastActiveAt: new Date().toISOString(),
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    await sessionRef(userId).set(session);
    return session;
}

/**
 * Append a message to the session and trim to MAX_HISTORY.
 */
export async function appendMessage(
    userId: string,
    role: 'user' | 'assistant',
    content: string,
): Promise<void> {
    const session = await getSession(userId);

    session.messages.push({
        role,
        content,
        timestamp: new Date().toISOString(),
    });

    // Trim to keep only last MAX_HISTORY messages
    if (session.messages.length > MAX_HISTORY) {
        session.messages = session.messages.slice(-MAX_HISTORY);
    }

    session.lastActiveAt = new Date().toISOString();

    await sessionRef(userId).set(session, { merge: true });
}

/**
 * Get previous messages formatted for AI context.
 * Returns the last N messages as a string array.
 */
export async function getPreviousMessages(userId: string): Promise<string[]> {
    const session = await getSession(userId);
    return session.messages.map(
        m => `${m.role === 'user' ? '用戶' : '助理'}：${m.content}`
    );
}

/**
 * Clear the conversation session for a user.
 */
export async function clearSession(userId: string): Promise<void> {
    await sessionRef(userId).delete();
    logger.info(`[Session] Cleared for ${userId}`);
}

/**
 * Get session summary for display (e.g., in Butler admin panel)
 */
export async function getSessionSummary(userId: string): Promise<{
    messageCount: number;
    sessionId: string;
    lastActiveAt: string;
    isExpired: boolean;
} | null> {
    const doc = await sessionRef(userId).get();
    if (!doc.exists) return null;

    const session = doc.data() as ConversationSession;
    const isExpired = Date.now() - new Date(session.lastActiveAt).getTime() > SESSION_TTL_MS;

    return {
        messageCount: session.messages.length,
        sessionId: session.sessionId,
        lastActiveAt: session.lastActiveAt,
        isExpired,
    };
}
