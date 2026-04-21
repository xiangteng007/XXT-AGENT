"use strict";
/**
 * Butler Conversation Session Service
 *
 * Provides multi-turn conversation support by storing recent messages
 * in Firestore. Each user has a rolling window of recent messages
 * that are included as context for AI responses.
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
exports.getSession = getSession;
exports.appendMessage = appendMessage;
exports.getPreviousMessages = getPreviousMessages;
exports.clearSession = clearSession;
exports.switchAgent = switchAgent;
exports.getSessionSummary = getSessionSummary;
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const MAX_HISTORY = 10; // Keep last N messages per user
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min inactivity = new session
// ================================
// Session Management
// ================================
function sessionRef(userId) {
    return db.doc(`users/${userId}/butler/conversation`);
}
/**
 * Get or create a conversation session for a user.
 * Automatically resets if session has been inactive for > SESSION_TTL_MS.
 */
async function getSession(userId) {
    const doc = await sessionRef(userId).get();
    if (doc.exists) {
        const session = doc.data();
        const lastActive = new Date(session.lastActiveAt).getTime();
        const now = Date.now();
        // Check if session expired
        if (now - lastActive > SESSION_TTL_MS) {
            v2_1.logger.info(`[Session] Expired for ${userId}, creating new session`);
            return createNewSession(userId);
        }
        return session;
    }
    return createNewSession(userId);
}
/**
 * Create a fresh conversation session
 */
async function createNewSession(userId) {
    const session = {
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
async function appendMessage(userId, role, content) {
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
async function getPreviousMessages(userId) {
    const session = await getSession(userId);
    return session.messages.map(m => `${m.role === 'user' ? '用戶' : '助理'}：${m.content}`);
}
/**
 * Clear the conversation session for a user.
 */
async function clearSession(userId) {
    await sessionRef(userId).delete();
    v2_1.logger.info(`[Session] Cleared for ${userId}`);
}
/**
 * Switch the active agent for a user's session
 */
async function switchAgent(userId, agentId) {
    const session = await getSession(userId);
    session.activeAgent = agentId;
    session.lastActiveAt = new Date().toISOString();
    await sessionRef(userId).set(session, { merge: true });
    v2_1.logger.info(`[Session] Switched agent to ${agentId} for ${userId}`);
}
/**
 * Get session summary for display (e.g., in Butler admin panel)
 */
async function getSessionSummary(userId) {
    const doc = await sessionRef(userId).get();
    if (!doc.exists)
        return null;
    const session = doc.data();
    const isExpired = Date.now() - new Date(session.lastActiveAt).getTime() > SESSION_TTL_MS;
    return {
        messageCount: session.messages.length,
        sessionId: session.sessionId,
        lastActiveAt: session.lastActiveAt,
        isExpired,
    };
}
//# sourceMappingURL=conversation-session.service.js.map