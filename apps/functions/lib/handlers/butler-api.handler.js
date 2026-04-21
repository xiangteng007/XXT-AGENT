"use strict";
/**
 * Butler API Handler
 *
 * HTTP Cloud Function endpoints for Personal Butler System.
 * Provides RESTful API access to all butler services.
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
exports.handleButlerApi = handleButlerApi;
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
// Import services
const butler_service_1 = require("../services/butler.service");
const health_service_1 = require("../services/health.service");
const health_integrations_service_1 = require("../services/health-integrations.service");
const finance_service_1 = require("../services/finance.service");
const vehicle_service_1 = require("../services/vehicle.service");
const schedule_service_1 = require("../services/schedule.service");
const business_service_1 = require("../services/business.service");
const investment_service_1 = require("../services/butler/investment.service");
const loan_service_1 = require("../services/butler/loan.service");
const monthly_insights_service_1 = require("../services/butler/monthly-insights.service");
const investment_report_service_1 = require("../services/butler/investment-report.service");
const schemas_1 = require("../validators/schemas");
// ================================
// CORS Whitelist
// ================================
const ALLOWED_ORIGINS = [
    'https://xxt-agent.vercel.app',
    'https://xxt-agent.web.app',
    'http://localhost:3000',
    'http://localhost:3001',
];
function getCorsOrigin(req) {
    const origin = req.headers.origin || '';
    return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}
// ================================
// Rate Limiting — In-Memory (V3 #10)
// ================================
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map();
function checkRateLimit(uid) {
    const now = Date.now();
    const entry = rateLimitMap.get(uid);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(uid, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= RATE_LIMIT_MAX)
        return false;
    entry.count++;
    return true;
}
// Periodic cleanup to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [uid, entry] of rateLimitMap) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2)
            rateLimitMap.delete(uid);
    }
}, 120_000);
// ================================
// Token Verification Cache (V3 #12)
// ================================
const TOKEN_CACHE_TTL_MS = 5 * 60_000; // 5 minutes
const tokenCache = new Map();
async function verifyAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
        return null;
    try {
        const token = authHeader.split('Bearer ')[1];
        // Check cache first
        const cached = tokenCache.get(token);
        if (cached && Date.now() < cached.expiresAt)
            return cached.uid;
        const decodedToken = await admin.auth().verifyIdToken(token);
        tokenCache.set(token, { uid: decodedToken.uid, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
        return decodedToken.uid;
    }
    catch {
        return null;
    }
}
// ================================
// Request ID (V3 #11)
// ================================
let requestCounter = 0;
function getRequestId() {
    return `req-${Date.now()}-${++requestCounter}`;
}
// ================================
// Main Butler API Handler
// ================================
async function handleButlerApi(req, res) {
    // CORS headers — whitelist only
    const origin = getCorsOrigin(req);
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }
    // Request correlation (V3 #11) + API version header (V3 #8)
    const requestId = getRequestId();
    res.set('X-Request-Id', requestId);
    res.set('X-API-Version', '2.1.0');
    // Health check (no auth required) — edge cacheable (V3 #26)
    if (req.path === '/health' || req.path === '/') {
        res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
        res.json({ status: 'ok', version: '2.1.0', timestamp: new Date().toISOString() });
        return;
    }
    // CSP violation report endpoint (V3 #13) — no auth required
    if (req.path === '/csp-report' && req.method === 'POST') {
        v2_1.logger.warn('[CSP Violation]', { body: req.body, userAgent: req.headers['user-agent'] });
        res.status(204).send('');
        return;
    }
    // Authenticate
    const uid = await verifyAuth(req);
    if (!uid) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    // Rate limiting
    const allowed = await checkRateLimit(uid);
    if (!allowed) {
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
        return;
    }
    // Parse route from path
    const path = req.path.replace(/^\/+/, '');
    const segments = path.split('/');
    const [module, action, param1, param2] = segments;
    try {
        switch (module) {
            case 'profile':
                await handleProfile(req, res, uid, action);
                break;
            case 'health':
                await handleHealth(req, res, uid, action, param1);
                break;
            case 'finance':
                await handleFinance(req, res, uid, action, param1, param2);
                break;
            case 'vehicle':
                await handleVehicle(req, res, uid, action, param1);
                break;
            case 'schedule':
                await handleSchedule(req, res, uid, action);
                break;
            case 'business':
                await handleBusiness(req, res, uid, action);
                break;
            case 'export':
                await handleExport(req, res, uid, action);
                break;
            case 'investment':
                await handleInvestment(req, res, uid, action);
                break;
            case 'loan':
                await handleLoan(req, res, uid);
                break;
            case 'insights':
                await handleInsights(req, res, uid, action);
                break;
            default:
                res.status(404).json({ error: 'Not found' });
        }
    }
    catch (error) {
        v2_1.logger.error('[Butler API Error]', { requestId, module, action, error });
        res.status(500).json({ error: 'Internal server error', requestId });
    }
}
// ================================
// Profile Handler
// ================================
async function handleProfile(req, res, uid, _action) {
    if (req.method === 'GET') {
        const profile = await butler_service_1.butlerService.getProfile(uid);
        res.json(profile);
    }
    else if (req.method === 'PUT') {
        await butler_service_1.butlerService.updateUserProfile(uid, req.body);
        res.json({ success: true });
    }
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
// ================================
// Health Handler
// ================================
async function handleHealth(req, res, uid, action, param1) {
    const method = req.method;
    switch (action) {
        case 'today':
            if (method === 'GET') {
                const today = new Date().toISOString().split('T')[0];
                const data = await health_service_1.healthService.getTodayHealth(uid);
                res.json(data || { date: today, steps: 0 });
            }
            break;
        case 'daily':
            if (method === 'POST') {
                await health_service_1.healthService.recordDailyHealth(uid, req.body);
                res.json({ success: true });
            }
            break;
        case 'workout':
            if (method === 'POST') {
                await health_service_1.healthService.recordWorkout(uid, req.body);
                res.json({ success: true });
            }
            break;
        case 'weight':
            if (param1 === 'history' && method === 'GET') {
                const days = parseInt(req.query.days) || 30;
                const history = await health_service_1.healthService.getWeightHistory(uid, days);
                res.json(history);
            }
            else if (method === 'POST') {
                const { weight, note } = req.body;
                await health_service_1.healthService.recordWeight(uid, weight, note);
                res.json({ success: true });
            }
            break;
        case 'progress':
            if (method === 'GET') {
                const progress = await health_service_1.healthService.calculateWeeklyProgress(uid);
                res.json(progress);
            }
            break;
        case 'recommendation':
            if (method === 'GET') {
                const profile = await butler_service_1.butlerService.getProfile(uid);
                if (!profile?.userProfile) {
                    res.status(400).json({ error: 'Profile not found' });
                    return;
                }
                const bmi = health_service_1.healthService.calculateBMI(profile.userProfile.weight, profile.userProfile.height);
                const hasHabit = profile.healthProfile?.exercisePreferences?.hasHabit || false;
                const recommendation = health_service_1.healthService.generateExerciseRecommendation(bmi, hasHabit);
                res.json(recommendation);
            }
            break;
        case 'sync':
            if (param1 === 'apple' && method === 'POST') {
                const payload = { ...req.body, userId: uid };
                const result = await (0, health_integrations_service_1.processAppleHealthSync)(payload);
                res.json(result);
            }
            break;
        default:
            res.status(404).json({ error: 'Health endpoint not found' });
    }
}
// ================================
// Finance Handler
// ================================
async function handleFinance(req, res, uid, action, param1, param2) {
    const method = req.method;
    switch (action) {
        case 'summary':
            if (method === 'GET' && param1 && param2) {
                const summary = await finance_service_1.financeService.getMonthlySummary(uid, parseInt(param1), parseInt(param2));
                res.json(summary);
            }
            break;
        case 'transactions':
            if (method === 'GET') {
                const qv = (0, schemas_1.validateBody)(schemas_1.TransactionQuerySchema, req.query);
                if (!qv.success) {
                    res.status(400).json({ error: qv.error });
                    return;
                }
                const transactions = await finance_service_1.financeService.getTransactions(uid, qv.data.startDate, qv.data.endDate, { type: qv.data.type, category: qv.data.category });
                res.json(transactions);
            }
            break;
        case 'transaction':
            if (method === 'POST') {
                const tv = (0, schemas_1.validateBody)(schemas_1.TransactionCreateSchema, req.body);
                if (!tv.success) {
                    res.status(400).json({ error: tv.error });
                    return;
                }
                const id = await finance_service_1.financeService.recordTransaction(uid, tv.data);
                res.json({ id });
            }
            break;
        case 'bills':
            if (method === 'GET') {
                const daysAhead = parseInt(req.query.days) || 7;
                const bills = await finance_service_1.financeService.getUpcomingBills(uid, daysAhead);
                res.json(bills);
            }
            break;
        case 'insights':
            if (method === 'GET') {
                const months = parseInt(req.query.months) || 3;
                const insights = await finance_service_1.financeService.getSpendingInsights(uid, months);
                res.json(insights);
            }
            break;
        default:
            res.status(404).json({ error: 'Finance endpoint not found' });
    }
}
// ================================
// Export Handler (CSV)
// ================================
async function handleExport(req, res, uid, format) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const now = new Date();
    const startDate = req.query.start || `${now.getFullYear()}-01-01`;
    const endDate = req.query.end || now.toISOString().split('T')[0];
    const transactions = await finance_service_1.financeService.getTransactions(uid, startDate, endDate, {});
    if (format === 'csv' || !format) {
        // BOM for Excel UTF-8 compatibility
        const BOM = '\uFEFF';
        const header = '日期,類型,金額,分類,描述,來源';
        const rows = transactions.map((tx) => `${tx.date},${tx.type === 'income' ? '收入' : '支出'},${tx.amount},${tx.category || ''},"${(tx.description || '').replace(/"/g, '""')}",${tx.source || ''}`);
        const csv = BOM + header + '\n' + rows.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="transactions_${startDate}_${endDate}.csv"`);
        res.send(csv);
    }
    else {
        res.json(transactions);
    }
}
// ================================
// Investment Handler
// ================================
async function handleInvestment(req, res, uid, action) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    switch (action) {
        case 'portfolio': {
            const summary = await investment_service_1.investmentService.getPortfolioSummary(uid);
            res.json(summary);
            break;
        }
        case 'report': {
            const html = await (0, investment_report_service_1.generateInvestmentReport)(uid);
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
            break;
        }
        default:
            res.status(404).json({ error: 'Investment endpoint not found' });
    }
}
// ================================
// Loan Handler
// ================================
async function handleLoan(req, res, uid) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const summary = await loan_service_1.loanService.getLoanSummary(uid);
    res.json(summary);
}
// ================================
// Insights Handler
// ================================
async function handleInsights(req, res, uid, action) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    switch (action) {
        case 'monthly': {
            const month = req.query.month;
            const report = await (0, monthly_insights_service_1.generateMonthlyInsights)(uid, month);
            res.json(report);
            break;
        }
        default:
            res.status(404).json({ error: 'Insights endpoint not found' });
    }
}
// ================================
// Vehicle Handler
// ================================
async function handleVehicle(req, res, uid, vehicleId, action) {
    const method = req.method;
    if (!vehicleId) {
        res.status(400).json({ error: 'Vehicle ID required' });
        return;
    }
    switch (action) {
        case undefined:
        case '':
            if (method === 'GET') {
                const vehicle = await vehicle_service_1.vehicleService.getVehicle(uid, vehicleId);
                res.json(vehicle);
            }
            break;
        case 'dashboard':
            if (method === 'GET') {
                const dashboard = await vehicle_service_1.vehicleService.getDashboard(uid, vehicleId);
                res.json(dashboard);
            }
            break;
        case 'fuel':
            if (method === 'POST') {
                const log = await vehicle_service_1.vehicleService.recordFuel(uid, vehicleId, req.body);
                res.json(log);
            }
            else if (method === 'GET') {
                const months = parseInt(req.query.months) || 6;
                const analysis = await vehicle_service_1.vehicleService.getFuelAnalysis(uid, vehicleId, months);
                res.json(analysis);
            }
            break;
        case 'maintenance':
            if (method === 'GET') {
                const schedule = await vehicle_service_1.vehicleService.getMaintenanceSchedule(uid, vehicleId);
                res.json(schedule);
            }
            break;
        case 'service':
            if (method === 'POST') {
                await vehicle_service_1.vehicleService.recordService(uid, vehicleId, req.body);
                res.json({ success: true });
            }
            break;
        default:
            res.status(404).json({ error: 'Vehicle endpoint not found' });
    }
}
// ================================
// Schedule Handler
// ================================
async function handleSchedule(req, res, uid, action) {
    const method = req.method;
    switch (action) {
        case 'today':
            if (method === 'GET') {
                const schedule = await schedule_service_1.scheduleService.getTodaySchedule(uid);
                res.json(schedule);
            }
            break;
        case 'week':
            if (method === 'GET') {
                const overview = await schedule_service_1.scheduleService.getWeekOverview(uid);
                res.json(overview);
            }
            break;
        case 'event':
            if (method === 'POST') {
                const event = await schedule_service_1.scheduleService.addEvent(uid, req.body);
                res.json(event);
            }
            break;
        case 'quick':
            if (method === 'POST') {
                const { text } = req.body;
                const parsed = schedule_service_1.scheduleService.parseQuickEvent(text);
                res.json(parsed);
            }
            break;
        case 'reminders':
            if (method === 'GET') {
                const minutes = parseInt(req.query.minutes) || 60;
                const reminders = await schedule_service_1.scheduleService.getUpcomingReminders(uid, minutes);
                res.json(reminders);
            }
            break;
        default:
            res.status(404).json({ error: 'Schedule endpoint not found' });
    }
}
// ================================
// Business Handler
// ================================
async function handleBusiness(req, res, uid, action) {
    const method = req.method;
    switch (action) {
        case 'dashboard':
            if (method === 'GET') {
                const dashboard = await business_service_1.businessService.getDashboard(uid);
                res.json(dashboard);
            }
            break;
        case 'projects':
            if (method === 'GET') {
                const projects = await business_service_1.businessService.getActiveProjects(uid);
                res.json(projects);
            }
            break;
        case 'project':
            if (method === 'POST') {
                const project = await business_service_1.businessService.addProject(uid, req.body);
                res.json(project);
            }
            break;
        case 'timeline':
            if (method === 'GET') {
                const timeline = await business_service_1.businessService.getProjectTimeline(uid);
                res.json(timeline);
            }
            break;
        case 'metrics':
            if (method === 'GET') {
                const year = parseInt(req.query.year) || undefined;
                const month = parseInt(req.query.month) || undefined;
                const metrics = await business_service_1.businessService.getMetrics(uid, year, month);
                res.json(metrics);
            }
            break;
        case 'payment':
            if (method === 'POST') {
                const { projectId, amount, note } = req.body;
                await business_service_1.businessService.recordPayment(uid, projectId, amount, note);
                res.json({ success: true });
            }
            break;
        default:
            res.status(404).json({ error: 'Business endpoint not found' });
    }
}
//# sourceMappingURL=butler-api.handler.js.map