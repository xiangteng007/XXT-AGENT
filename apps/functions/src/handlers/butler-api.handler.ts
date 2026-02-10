/**
 * Butler API Handler
 * 
 * HTTP Cloud Function endpoints for Personal Butler System.
 * Provides RESTful API access to all butler services.
 */

import { logger } from 'firebase-functions/v2';
import { Request, Response } from 'express';
import * as admin from 'firebase-admin';


// Import services
import { butlerService } from '../services/butler.service';
import { healthService } from '../services/health.service';
import { processAppleHealthSync } from '../services/health-integrations.service';
import { financeService } from '../services/finance.service';
import { vehicleService } from '../services/vehicle.service';
import { scheduleService } from '../services/schedule.service';
import { businessService } from '../services/business.service';
import { investmentService } from '../services/butler/investment.service';
import { loanService } from '../services/butler/loan.service';
import { generateMonthlyInsights } from '../services/butler/monthly-insights.service';
import { generateInvestmentReport } from '../services/butler/investment-report.service';
import { validateBody, TransactionCreateSchema, TransactionQuerySchema } from '../validators/schemas';

// ================================
// CORS Whitelist
// ================================
const ALLOWED_ORIGINS = [
    'https://xxt-agent.vercel.app',
    'https://xxt-agent.web.app',
    'http://localhost:3000',
    'http://localhost:3001',
];

function getCorsOrigin(req: Request): string {
    const origin = req.headers.origin || '';
    return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

// ================================
// Rate Limiting — In-Memory (V3 #10)
// ================================
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(uid: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(uid);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(uid, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= RATE_LIMIT_MAX) return false;
    entry.count++;
    return true;
}

// Periodic cleanup to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [uid, entry] of rateLimitMap) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(uid);
    }
}, 120_000);

// ================================
// Token Verification Cache (V3 #12)
// ================================
const TOKEN_CACHE_TTL_MS = 5 * 60_000; // 5 minutes
const tokenCache = new Map<string, { uid: string; expiresAt: number }>();

async function verifyAuth(req: Request): Promise<string | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    
    try {
        const token = authHeader.split('Bearer ')[1];
        
        // Check cache first
        const cached = tokenCache.get(token);
        if (cached && Date.now() < cached.expiresAt) return cached.uid;
        
        const decodedToken = await admin.auth().verifyIdToken(token);
        tokenCache.set(token, { uid: decodedToken.uid, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
        return decodedToken.uid;
    } catch {
        return null;
    }
}

// ================================
// Request ID (V3 #11)
// ================================
let requestCounter = 0;
function getRequestId(): string {
    return `req-${Date.now()}-${++requestCounter}`;
}

// ================================
// Main Butler API Handler
// ================================

export async function handleButlerApi(req: Request, res: Response): Promise<void> {
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

    // Request correlation (V3 #11)
    const requestId = getRequestId();
    res.set('X-Request-Id', requestId);

    // Health check (no auth required)
    if (req.path === '/health' || req.path === '/') {
        res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
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
    } catch (error) {
        logger.error('[Butler API Error]', { requestId, module, action, error });
        res.status(500).json({ error: 'Internal server error', requestId });
    }
}

// ================================
// Profile Handler
// ================================

async function handleProfile(req: Request, res: Response, uid: string, _action: string): Promise<void> {
    if (req.method === 'GET') {
        const profile = await butlerService.getProfile(uid);
        res.json(profile);
    } else if (req.method === 'PUT') {
        await butlerService.updateUserProfile(uid, req.body);
        res.json({ success: true });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}

// ================================
// Health Handler
// ================================

async function handleHealth(
    req: Request, res: Response, uid: string, action: string, param1?: string
): Promise<void> {
    const method = req.method;
    
    switch (action) {
        case 'today':
            if (method === 'GET') {
                const today = new Date().toISOString().split('T')[0];
                const data = await healthService.getTodayHealth(uid);
                res.json(data || { date: today, steps: 0 });
            }
            break;
            
        case 'daily':
            if (method === 'POST') {
                await healthService.recordDailyHealth(uid, req.body);
                res.json({ success: true });
            }
            break;
            
        case 'workout':
            if (method === 'POST') {
                await healthService.recordWorkout(uid, req.body);
                res.json({ success: true });
            }
            break;
            
        case 'weight':
            if (param1 === 'history' && method === 'GET') {
                const days = parseInt(req.query.days as string) || 30;
                const history = await healthService.getWeightHistory(uid, days);
                res.json(history);
            } else if (method === 'POST') {
                const { weight, note } = req.body;
                await healthService.recordWeight(uid, weight, note);
                res.json({ success: true });
            }
            break;
            
        case 'progress':
            if (method === 'GET') {
                const progress = await healthService.calculateWeeklyProgress(uid);
                res.json(progress);
            }
            break;
            
        case 'recommendation':
            if (method === 'GET') {
                const profile = await butlerService.getProfile(uid);
                if (!profile?.userProfile) {
                    res.status(400).json({ error: 'Profile not found' });
                    return;
                }
                const bmi = healthService.calculateBMI(profile.userProfile.weight, profile.userProfile.height);
                const hasHabit = profile.healthProfile?.exercisePreferences?.hasHabit || false;
                const recommendation = healthService.generateExerciseRecommendation(bmi, hasHabit);
                res.json(recommendation);
            }
            break;
            
        case 'sync':
            if (param1 === 'apple' && method === 'POST') {
                const payload = { ...req.body, userId: uid };
                const result = await processAppleHealthSync(payload);
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

async function handleFinance(
    req: Request, res: Response, uid: string, action: string, param1?: string, param2?: string
): Promise<void> {
    const method = req.method;
    
    switch (action) {
        case 'summary':
            if (method === 'GET' && param1 && param2) {
                const summary = await financeService.getMonthlySummary(uid, parseInt(param1), parseInt(param2));
                res.json(summary);
            }
            break;
            
        case 'transactions':
            if (method === 'GET') {
                const qv = validateBody(TransactionQuerySchema, req.query);
                if (!qv.success) { res.status(400).json({ error: qv.error }); return; }
                const transactions = await financeService.getTransactions(
                    uid, qv.data.startDate as string, qv.data.endDate as string,
                    { type: qv.data.type as 'income' | 'expense', category: qv.data.category as string }
                );
                res.json(transactions);
            }
            break;
            
        case 'transaction':
            if (method === 'POST') {
                const tv = validateBody(TransactionCreateSchema, req.body);
                if (!tv.success) { res.status(400).json({ error: tv.error }); return; }
                const id = await financeService.recordTransaction(uid, tv.data);
                res.json({ id });
            }
            break;
            
        case 'bills':
            if (method === 'GET') {
                const daysAhead = parseInt(req.query.days as string) || 7;
                const bills = await financeService.getUpcomingBills(uid, daysAhead);
                res.json(bills);
            }
            break;
            
        case 'insights':
            if (method === 'GET') {
                const months = parseInt(req.query.months as string) || 3;
                const insights = await financeService.getSpendingInsights(uid, months);
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

async function handleExport(req: Request, res: Response, uid: string, format: string): Promise<void> {
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const now = new Date();
    const startDate = (req.query.start as string) || `${now.getFullYear()}-01-01`;
    const endDate = (req.query.end as string) || now.toISOString().split('T')[0];

    const transactions = await financeService.getTransactions(uid, startDate, endDate, {});

    if (format === 'csv' || !format) {
        // BOM for Excel UTF-8 compatibility
        const BOM = '\uFEFF';
        const header = '日期,類型,金額,分類,描述,來源';
        const rows = transactions.map((tx: { date: string; type: string; amount: number; category: string; description: string; source?: string }) =>
            `${tx.date},${tx.type === 'income' ? '收入' : '支出'},${tx.amount},${tx.category || ''},"${(tx.description || '').replace(/"/g, '""')}",${tx.source || ''}`
        );
        const csv = BOM + header + '\n' + rows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="transactions_${startDate}_${endDate}.csv"`);
        res.send(csv);
    } else {
        res.json(transactions);
    }
}

// ================================
// Investment Handler
// ================================

async function handleInvestment(req: Request, res: Response, uid: string, action: string): Promise<void> {
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
    switch (action) {
        case 'portfolio': {
            const summary = await investmentService.getPortfolioSummary(uid);
            res.json(summary);
            break;
        }
        case 'report': {
            const html = await generateInvestmentReport(uid);
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

async function handleLoan(req: Request, res: Response, uid: string): Promise<void> {
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
    const summary = await loanService.getLoanSummary(uid);
    res.json(summary);
}

// ================================
// Insights Handler
// ================================

async function handleInsights(req: Request, res: Response, uid: string, action: string): Promise<void> {
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
    switch (action) {
        case 'monthly': {
            const month = req.query.month as string | undefined;
            const report = await generateMonthlyInsights(uid, month);
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

async function handleVehicle(
    req: Request, res: Response, uid: string, vehicleId: string, action?: string
): Promise<void> {
    const method = req.method;
    
    if (!vehicleId) {
        res.status(400).json({ error: 'Vehicle ID required' });
        return;
    }
    
    switch (action) {
        case undefined:
        case '':
            if (method === 'GET') {
                const vehicle = await vehicleService.getVehicle(uid, vehicleId);
                res.json(vehicle);
            }
            break;
            
        case 'dashboard':
            if (method === 'GET') {
                const dashboard = await vehicleService.getDashboard(uid, vehicleId);
                res.json(dashboard);
            }
            break;
            
        case 'fuel':
            if (method === 'POST') {
                const log = await vehicleService.recordFuel(uid, vehicleId, req.body);
                res.json(log);
            } else if (method === 'GET') {
                const months = parseInt(req.query.months as string) || 6;
                const analysis = await vehicleService.getFuelAnalysis(uid, vehicleId, months);
                res.json(analysis);
            }
            break;
            
        case 'maintenance':
            if (method === 'GET') {
                const schedule = await vehicleService.getMaintenanceSchedule(uid, vehicleId);
                res.json(schedule);
            }
            break;
            
        case 'service':
            if (method === 'POST') {
                await vehicleService.recordService(uid, vehicleId, req.body);
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

async function handleSchedule(req: Request, res: Response, uid: string, action: string): Promise<void> {
    const method = req.method;
    
    switch (action) {
        case 'today':
            if (method === 'GET') {
                const schedule = await scheduleService.getTodaySchedule(uid);
                res.json(schedule);
            }
            break;
            
        case 'week':
            if (method === 'GET') {
                const overview = await scheduleService.getWeekOverview(uid);
                res.json(overview);
            }
            break;
            
        case 'event':
            if (method === 'POST') {
                const event = await scheduleService.addEvent(uid, req.body);
                res.json(event);
            }
            break;
            
        case 'quick':
            if (method === 'POST') {
                const { text } = req.body;
                const parsed = scheduleService.parseQuickEvent(text);
                res.json(parsed);
            }
            break;
            
        case 'reminders':
            if (method === 'GET') {
                const minutes = parseInt(req.query.minutes as string) || 60;
                const reminders = await scheduleService.getUpcomingReminders(uid, minutes);
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

async function handleBusiness(req: Request, res: Response, uid: string, action: string): Promise<void> {
    const method = req.method;
    
    switch (action) {
        case 'dashboard':
            if (method === 'GET') {
                const dashboard = await businessService.getDashboard(uid);
                res.json(dashboard);
            }
            break;
            
        case 'projects':
            if (method === 'GET') {
                const projects = await businessService.getActiveProjects(uid);
                res.json(projects);
            }
            break;
            
        case 'project':
            if (method === 'POST') {
                const project = await businessService.addProject(uid, req.body);
                res.json(project);
            }
            break;
            
        case 'timeline':
            if (method === 'GET') {
                const timeline = await businessService.getProjectTimeline(uid);
                res.json(timeline);
            }
            break;
            
        case 'metrics':
            if (method === 'GET') {
                const year = parseInt(req.query.year as string) || undefined;
                const month = parseInt(req.query.month as string) || undefined;
                const metrics = await businessService.getMetrics(uid, year, month);
                res.json(metrics);
            }
            break;
            
        case 'payment':
            if (method === 'POST') {
                const { projectId, amount, note } = req.body;
                await businessService.recordPayment(uid, projectId, amount, note);
                res.json({ success: true });
            }
            break;
            
        default:
            res.status(404).json({ error: 'Business endpoint not found' });
    }
}
