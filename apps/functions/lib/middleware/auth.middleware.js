"use strict";
/**
 * Authentication Middleware
 * Verifies Firebase Auth tokens and injects user context
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireTeam = requireTeam;
exports.requireSuperadmin = requireSuperadmin;
exports.getCurrentTeamRole = getCurrentTeamRole;
const auth_1 = require("firebase-admin/auth");
const rbac_service_1 = require("../services/rbac.service");
const auth = (0, auth_1.getAuth)();
/**
 * Create authentication middleware
 */
function authenticate(options = {}) {
    const { required = true, loadContext = true } = options;
    return async (req, res, next) => {
        const authReq = req;
        try {
            // Extract token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                if (required) {
                    res.status(401).json({
                        success: false,
                        error: 'Unauthorized',
                        message: '缺少認證令牌',
                    });
                    return;
                }
                next();
                return;
            }
            const token = authHeader.split('Bearer ')[1];
            // Verify Firebase ID token
            const decodedToken = await auth.verifyIdToken(token);
            authReq.userId = decodedToken.uid;
            // Extract team ID from headers or query params
            authReq.teamId = req.headers['x-team-id'] || req.query.teamId;
            // Load full user context if needed
            if (loadContext) {
                const userContext = await rbac_service_1.rbacService.getUserContext(decodedToken.uid);
                if (!userContext) {
                    if (required) {
                        res.status(401).json({
                            success: false,
                            error: 'Unauthorized',
                            message: '無法獲取用戶資訊',
                        });
                        return;
                    }
                }
                else {
                    authReq.user = userContext;
                }
            }
            else {
                // Minimal user context from token claims
                const claims = decodedToken;
                authReq.user = {
                    userId: decodedToken.uid,
                    email: decodedToken.email || '',
                    displayName: decodedToken.name || '',
                    globalRole: claims.globalRole || 'user',
                    teamMemberships: [],
                };
            }
            next();
        }
        catch (error) {
            console.error('Authentication error:', error);
            if (required) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    message: '認證令牌無效或已過期',
                });
                return;
            }
            next();
        }
    };
}
/**
 * Middleware to require a specific team context
 */
function requireTeam(req, res, next) {
    const authReq = req;
    if (!authReq.teamId) {
        res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: '缺少團隊 ID (X-Team-Id header 或 teamId query param)',
        });
        return;
    }
    // Verify user is member of the team
    if (authReq.user) {
        const membership = authReq.user.teamMemberships.find(m => m.teamId === authReq.teamId);
        if (!membership && authReq.user.globalRole !== 'superadmin') {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: '您不是此團隊的成員',
            });
            return;
        }
    }
    next();
}
/**
 * Middleware to require superadmin role
 */
function requireSuperadmin(req, res, next) {
    const authReq = req;
    if (!authReq.user || authReq.user.globalRole !== 'superadmin') {
        res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: '此操作需要系統管理員權限',
        });
        return;
    }
    next();
}
/**
 * Get current user's role in a specific team
 */
function getCurrentTeamRole(req) {
    if (!req.user || !req.teamId)
        return null;
    if (req.user.globalRole === 'superadmin')
        return 'superadmin';
    const membership = req.user.teamMemberships.find(m => m.teamId === req.teamId);
    return membership?.role || null;
}
//# sourceMappingURL=auth.middleware.js.map