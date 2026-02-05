"use strict";
/**
 * Business Service
 *
 * Provides business management capabilities for interior design company:
 * - Project tracking (設計專案管理)
 * - Client management (客戶管理)
 * - Business metrics dashboard
 * - Invoice and payment tracking
 * - Team workload overview
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
exports.businessService = exports.BusinessService = void 0;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ================================
// Business Service Class
// ================================
class BusinessService {
    /**
     * Add a new project
     */
    async addProject(uid, project) {
        const id = `proj_${Date.now()}`;
        const newProject = {
            id,
            ...project,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        };
        await db.doc(`users/${uid}/butler/business/projects/${id}`).set(newProject);
        return newProject;
    }
    /**
     * Get project by ID
     */
    async getProject(uid, projectId) {
        const doc = await db.doc(`users/${uid}/butler/business/projects/${projectId}`).get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    /**
     * Get all active projects
     */
    async getActiveProjects(uid) {
        const activeStatuses = ['inquiry', 'proposal', 'contracted', 'in_progress'];
        const snapshot = await db
            .collection(`users/${uid}/butler/business/projects`)
            .where('status', 'in', activeStatuses)
            .orderBy('updatedAt', 'desc')
            .get();
        return snapshot.docs.map(doc => doc.data());
    }
    /**
     * Update project status
     */
    async updateProjectStatus(uid, projectId, status, phase) {
        const updates = {
            status,
            updatedAt: admin.firestore.Timestamp.now(),
        };
        if (phase) {
            updates.phase = phase;
        }
        if (status === 'completed') {
            updates.actualEndDate = new Date().toISOString().split('T')[0];
        }
        await db.doc(`users/${uid}/butler/business/projects/${projectId}`).update(updates);
    }
    /**
     * Record payment received
     */
    async recordPayment(uid, projectId, amount, note) {
        const project = await this.getProject(uid, projectId);
        if (!project)
            throw new Error('Project not found');
        // Update paid amount
        await db.doc(`users/${uid}/butler/business/projects/${projectId}`).update({
            paidAmount: admin.firestore.FieldValue.increment(amount),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        // Log payment
        await db.collection(`users/${uid}/butler/business/payments`).add({
            projectId,
            projectName: project.name,
            clientName: project.clientName,
            amount,
            date: new Date().toISOString().split('T')[0],
            note,
            createdAt: admin.firestore.Timestamp.now(),
        });
    }
    /**
     * Add a new client
     */
    async addClient(uid, client) {
        const id = `client_${Date.now()}`;
        const newClient = {
            id,
            ...client,
            totalProjects: 0,
            totalRevenue: 0,
            createdAt: admin.firestore.Timestamp.now(),
        };
        await db.doc(`users/${uid}/butler/business/clients/${id}`).set(newClient);
        return newClient;
    }
    /**
     * Get business metrics
     */
    async getMetrics(uid, year, month) {
        const now = new Date();
        const targetYear = year || now.getFullYear();
        const targetMonth = month || now.getMonth() + 1;
        // Date range for future filtering (prepared but not used yet)
        // const dateRange = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
        // Get all projects
        const allProjects = await db
            .collection(`users/${uid}/butler/business/projects`)
            .get();
        const projects = allProjects.docs.map(doc => doc.data());
        // Calculate metrics
        const activeProjects = projects.filter(p => ['contracted', 'in_progress'].includes(p.status));
        const completedProjects = projects.filter(p => p.status === 'completed');
        const inquiries = projects.filter(p => p.status === 'inquiry');
        const proposals = projects.filter(p => p.status === 'proposal');
        // Revenue calculations
        const contractedRevenue = activeProjects.reduce((sum, p) => sum + p.contractAmount, 0);
        const receivedRevenue = projects.reduce((sum, p) => sum + p.paidAmount, 0);
        const outstandingRevenue = projects.reduce((sum, p) => sum + (p.contractAmount - p.paidAmount), 0);
        // Projects by type
        const byType = {
            residential_new: 0,
            residential_reno: 0,
            commercial: 0,
            office: 0,
            other: 0,
        };
        projects.forEach(p => {
            byType[p.type] = (byType[p.type] || 0) + 1;
        });
        // Pipeline value
        const potentialValue = [...inquiries, ...proposals].reduce((sum, p) => sum + p.contractAmount, 0);
        return {
            period: `${targetYear}年${targetMonth}月`,
            revenue: {
                contracted: contractedRevenue,
                received: receivedRevenue,
                outstanding: Math.max(0, outstandingRevenue),
            },
            projects: {
                total: projects.length,
                inProgress: activeProjects.length,
                completed: completedProjects.length,
                byType,
            },
            pipeline: {
                inquiries: inquiries.length,
                proposals: proposals.length,
                potentialValue,
            },
        };
    }
    /**
     * Get project timeline overview
     */
    async getProjectTimeline(uid) {
        const projects = await this.getActiveProjects(uid);
        return projects.map(p => ({
            projectId: p.id,
            projectName: p.name,
            clientName: p.clientName,
            status: p.status,
            phase: p.phase,
            startDate: p.startDate,
            estimatedEndDate: p.estimatedEndDate,
            daysRemaining: this.daysUntil(p.estimatedEndDate),
            progress: this.calculateProgress(p),
            isOverdue: this.daysUntil(p.estimatedEndDate) < 0,
        }));
    }
    /**
     * Get overdue projects
     */
    async getOverdueProjects(uid) {
        const projects = await this.getActiveProjects(uid);
        const today = new Date().toISOString().split('T')[0];
        return projects.filter(p => p.estimatedEndDate < today && p.status !== 'completed');
    }
    /**
     * Get business dashboard
     */
    async getDashboard(uid) {
        const [metrics, activeProjects, overdueProjects] = await Promise.all([
            this.getMetrics(uid),
            this.getActiveProjects(uid),
            this.getOverdueProjects(uid),
        ]);
        // Get projects needing attention (high value or near deadline)
        const attentionProjects = activeProjects.filter(p => this.daysUntil(p.estimatedEndDate) <= 14 || p.contractAmount >= 1000000);
        return {
            metrics,
            activeProjectCount: activeProjects.length,
            overdueProjectCount: overdueProjects.length,
            attentionProjects: attentionProjects.map(p => ({
                id: p.id,
                name: p.name,
                client: p.clientName,
                daysRemaining: this.daysUntil(p.estimatedEndDate),
                phase: p.phase,
            })),
            recentPayments: [], // Would fetch from payments collection
        };
    }
    // ================================
    // Helper Methods
    // ================================
    daysUntil(dateStr) {
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    calculateProgress(project) {
        const phaseProgress = {
            design: 10,
            quote: 20,
            contract: 30,
            construction: 70,
            inspection: 90,
            warranty: 95,
            closed: 100,
        };
        return phaseProgress[project.phase] || 0;
    }
}
exports.BusinessService = BusinessService;
exports.businessService = new BusinessService();
//# sourceMappingURL=business.service.js.map