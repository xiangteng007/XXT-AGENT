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
export interface DesignProject {
    id: string;
    name: string;
    clientId: string;
    clientName: string;
    type: ProjectType;
    status: ProjectStatus;
    phase: ProjectPhase;
    address: string;
    area: number;
    startDate: string;
    estimatedEndDate: string;
    actualEndDate?: string;
    contractAmount: number;
    paidAmount: number;
    costToDate: number;
    designerInCharge: string;
    teamMembers: string[];
    tags: string[];
    notes?: string;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
}
export type ProjectType = 'residential_new' | 'residential_reno' | 'commercial' | 'office' | 'other';
export type ProjectStatus = 'inquiry' | 'proposal' | 'contracted' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
export type ProjectPhase = 'design' | 'quote' | 'contract' | 'construction' | 'inspection' | 'warranty' | 'closed';
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
export declare class BusinessService {
    /**
     * Add a new project
     */
    addProject(uid: string, project: Omit<DesignProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<DesignProject>;
    /**
     * Get project by ID
     */
    getProject(uid: string, projectId: string): Promise<DesignProject | null>;
    /**
     * Get all active projects
     */
    getActiveProjects(uid: string): Promise<DesignProject[]>;
    /**
     * Update project status
     */
    updateProjectStatus(uid: string, projectId: string, status: ProjectStatus, phase?: ProjectPhase): Promise<void>;
    /**
     * Record payment received
     */
    recordPayment(uid: string, projectId: string, amount: number, note?: string): Promise<void>;
    /**
     * Add a new client
     */
    addClient(uid: string, client: Omit<Client, 'id' | 'totalProjects' | 'totalRevenue' | 'createdAt'>): Promise<Client>;
    /**
     * Get business metrics
     */
    getMetrics(uid: string, year?: number, month?: number): Promise<BusinessMetrics>;
    /**
     * Get project timeline overview
     */
    getProjectTimeline(uid: string): Promise<ProjectTimelineItem[]>;
    /**
     * Get overdue projects
     */
    getOverdueProjects(uid: string): Promise<DesignProject[]>;
    /**
     * Get business dashboard
     */
    getDashboard(uid: string): Promise<BusinessDashboard>;
    private daysUntil;
    private calculateProgress;
}
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
export declare const businessService: BusinessService;
//# sourceMappingURL=business.service.d.ts.map