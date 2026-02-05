import { Timestamp } from 'firebase-admin/firestore';
/**
 * Team document schema
 */
export interface Team {
    id: string;
    name: string;
    slug: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    ownerId: string;
    lineChannelId?: string;
    plan: 'free' | 'pro' | 'enterprise';
    settings: TeamSettings;
}
export interface TeamSettings {
    replyEnabled: boolean;
    defaultTimezone: string;
    replyMessages?: {
        success?: string;
        failure?: string;
        noMatch?: string;
    };
}
/**
 * Team member document schema
 */
export interface TeamMember {
    userId: string;
    email: string;
    displayName: string;
    role: 'owner' | 'admin' | 'member';
    permissions: MemberPermissions;
    joinedAt: Timestamp;
}
export interface MemberPermissions {
    canManageTeam: boolean;
    canManageProjects: boolean;
    canManageRules: boolean;
    canViewLogs: boolean;
}
/**
 * Project document schema
 */
export interface Project {
    id: string;
    teamId: string;
    name: string;
    description: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    isActive: boolean;
    notionIntegrationId: string;
    defaultDatabaseId?: string;
}
/**
 * Rule document schema
 */
export interface Rule {
    id: string;
    projectId: string;
    name: string;
    priority: number;
    isActive: boolean;
    matcher: RuleMatcher;
    action: RuleAction;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface RuleMatcher {
    type: 'keyword' | 'prefix' | 'regex' | 'contains';
    pattern: string;
    caseSensitive: boolean;
}
export interface RuleAction {
    databaseId: string;
    fieldMapping: FieldMapping;
    removePattern: boolean;
}
export interface FieldMapping {
    title: string;
    date?: string;
    status?: string;
    tags?: string[];
    customFields?: Record<string, string | number | boolean>;
}
/**
 * Database config document schema
 */
export interface DatabaseConfig {
    id: string;
    notionDatabaseId: string;
    name: string;
    schema: Record<string, DatabaseFieldSchema>;
    lastSyncedAt: Timestamp;
}
export interface DatabaseFieldSchema {
    type: 'title' | 'rich_text' | 'select' | 'multi_select' | 'date' | 'status' | 'number' | 'checkbox';
    options?: string[];
}
/**
 * Integration document schema
 */
export interface Integration {
    id: string;
    teamId: string;
    type: 'line' | 'notion';
    name: string;
    line?: LineIntegration;
    notion?: NotionIntegration;
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface LineIntegration {
    channelId: string;
}
export interface NotionIntegration {
    workspaceId: string;
    workspaceName: string;
}
/**
 * Operation log document schema
 */
export interface OperationLog {
    id: string;
    teamId: string;
    projectId?: string;
    type: LogType;
    message?: MessageLog;
    notion?: NotionLog;
    timestamp: Timestamp;
    duration?: number;
}
export type LogType = 'message_received' | 'notion_write' | 'error' | 'config_change';
export interface MessageLog {
    lineUserId: string;
    messageType: 'text' | 'image' | 'location' | 'sticker';
    contentPreview: string;
    matchedRuleId?: string;
}
export interface NotionLog {
    databaseId: string;
    pageId?: string;
    status: 'success' | 'failed' | 'retrying';
    errorCode?: string;
    errorMessage?: string;
    retryCount?: number;
}
/**
 * Tenant configuration (runtime aggregated type)
 */
export interface TenantConfig {
    teamId: string;
    projectId: string;
    integrationId: string;
    notionIntegrationId: string;
    defaultDatabaseId?: string;
    settings: TeamSettings;
}
//# sourceMappingURL=index.d.ts.map