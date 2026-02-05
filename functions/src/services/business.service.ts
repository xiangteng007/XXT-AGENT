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

import * as admin from 'firebase-admin';

const db = admin.firestore();

// ================================
// Business Types
// ================================

export interface DesignProject {
    id: string;
    name: string;
    clientId: string;
    clientName: string;
    type: ProjectType;
    status: ProjectStatus;
    phase: ProjectPhase;
    
    // Location
    address: string;
    area: number; // 坪
    
    // Timeline
    startDate: string;
    estimatedEndDate: string;
    actualEndDate?: string;
    
    // Financials
    contractAmount: number;
    paidAmount: number;
    costToDate: number;
    
    // Team
    designerInCharge: string;
    teamMembers: string[];
    
    // Metadata
    tags: string[];
    notes?: string;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
}

export type ProjectType = 
    | 'residential_new'      // 新屋設計
    | 'residential_reno'     // 老屋翻新
    | 'commercial'           // 商業空間
    | 'office'               // 辦公室
    | 'other';

export type ProjectStatus = 
    | 'inquiry'      // 洽談中
    | 'proposal'     // 提案中
    | 'contracted'   // 已簽約
    | 'in_progress'  // 施工中
    | 'completed'    // 已完工
    | 'on_hold'      // 暫停
    | 'cancelled';   // 取消

export type ProjectPhase =
    | 'design'           // 設計階段
    | 'quote'            // 報價階段
    | 'contract'         // 簽約階段
    | 'construction'     // 施工階段
    | 'inspection'       // 驗收階段
    | 'warranty'         // 保固期
    | 'closed';          // 結案

export interface Client {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    referralSource?: string;
    totalProjects: number;
    totalRevenue: number;
    notes?: string;
    createdAt: admin.firestore.Timestamp;
}

export interface BusinessMetrics {
    period: string;
    revenue: {
        contracted: number;
        received: number;
        outstanding: number;
    };
    projects: {
        total: number;
        inProgress: number;
        completed: number;
        byType: Record<ProjectType, number>;
    };
    pipeline: {
        inquiries: number;
        proposals: number;
        potentialValue: number;
    };
}

// ================================
// Business Service Class
// ================================

export class BusinessService {
    /**
     * Add a new project
     */
    async addProject(uid: string, project: Omit<DesignProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<DesignProject> {
        const id = `proj_${Date.now()}`;
        
        const newProject: DesignProject = {
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
    async getProject(uid: string, projectId: string): Promise<DesignProject | null> {
        const doc = await db.doc(`users/${uid}/butler/business/projects/${projectId}`).get();
        if (!doc.exists) return null;
        return doc.data() as DesignProject;
    }

    /**
     * Get all active projects
     */
    async getActiveProjects(uid: string): Promise<DesignProject[]> {
        const activeStatuses: ProjectStatus[] = ['inquiry', 'proposal', 'contracted', 'in_progress'];
        
        const snapshot = await db
            .collection(`users/${uid}/butler/business/projects`)
            .where('status', 'in', activeStatuses)
            .orderBy('updatedAt', 'desc')
            .get();
        
        return snapshot.docs.map(doc => doc.data() as DesignProject);
    }

    /**
     * Update project status
     */
    async updateProjectStatus(uid: string, projectId: string, status: ProjectStatus, phase?: ProjectPhase): Promise<void> {
        const updates: Record<string, unknown> = {
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
    async recordPayment(uid: string, projectId: string, amount: number, note?: string): Promise<void> {
        const project = await this.getProject(uid, projectId);
        if (!project) throw new Error('Project not found');
        
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
    async addClient(uid: string, client: Omit<Client, 'id' | 'totalProjects' | 'totalRevenue' | 'createdAt'>): Promise<Client> {
        const id = `client_${Date.now()}`;
        
        const newClient: Client = {
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
    async getMetrics(uid: string, year?: number, month?: number): Promise<BusinessMetrics> {
        const now = new Date();
        const targetYear = year || now.getFullYear();
        const targetMonth = month || now.getMonth() + 1;
        
        // Date range for future filtering (prepared but not used yet)
        // const dateRange = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
        
        // Get all projects
        const allProjects = await db
            .collection(`users/${uid}/butler/business/projects`)
            .get();
        
        const projects = allProjects.docs.map(doc => doc.data() as DesignProject);
        
        // Calculate metrics
        const activeProjects = projects.filter(p => 
            ['contracted', 'in_progress'].includes(p.status)
        );
        const completedProjects = projects.filter(p => p.status === 'completed');
        const inquiries = projects.filter(p => p.status === 'inquiry');
        const proposals = projects.filter(p => p.status === 'proposal');
        
        // Revenue calculations
        const contractedRevenue = activeProjects.reduce((sum, p) => sum + p.contractAmount, 0);
        const receivedRevenue = projects.reduce((sum, p) => sum + p.paidAmount, 0);
        const outstandingRevenue = projects.reduce((sum, p) => sum + (p.contractAmount - p.paidAmount), 0);
        
        // Projects by type
        const byType: Record<ProjectType, number> = {
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
    async getProjectTimeline(uid: string): Promise<ProjectTimelineItem[]> {
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
    async getOverdueProjects(uid: string): Promise<DesignProject[]> {
        const projects = await this.getActiveProjects(uid);
        const today = new Date().toISOString().split('T')[0];
        
        return projects.filter(p => p.estimatedEndDate < today && p.status !== 'completed');
    }

    /**
     * Get business dashboard
     */
    async getDashboard(uid: string): Promise<BusinessDashboard> {
        const [metrics, activeProjects, overdueProjects] = await Promise.all([
            this.getMetrics(uid),
            this.getActiveProjects(uid),
            this.getOverdueProjects(uid),
        ]);
        
        // Get projects needing attention (high value or near deadline)
        const attentionProjects = activeProjects.filter(p => 
            this.daysUntil(p.estimatedEndDate) <= 14 || p.contractAmount >= 1000000
        );
        
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

    private daysUntil(dateStr: string): number {
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    private calculateProgress(project: DesignProject): number {
        const phaseProgress: Record<ProjectPhase, number> = {
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

// ================================
// Additional Types
// ================================

export interface ProjectTimelineItem {
    projectId: string;
    projectName: string;
    clientName: string;
    status: ProjectStatus;
    phase: ProjectPhase;
    startDate: string;
    estimatedEndDate: string;
    daysRemaining: number;
    progress: number;
    isOverdue: boolean;
}

export interface BusinessDashboard {
    metrics: BusinessMetrics;
    activeProjectCount: number;
    overdueProjectCount: number;
    attentionProjects: {
        id: string;
        name: string;
        client: string;
        daysRemaining: number;
        phase: ProjectPhase;
    }[];
    recentPayments: {
        projectName: string;
        amount: number;
        date: string;
    }[];
}

export const businessService = new BusinessService();
