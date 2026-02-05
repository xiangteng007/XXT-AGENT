import { Team, Project, TenantConfig } from '../models';
/**
 * Find tenant configuration by LINE Channel ID
 */
export declare function findTenantByChannelId(channelId: string): Promise<TenantConfig | null>;
/**
 * Get team by ID
 */
export declare function getTeam(teamId: string): Promise<Team | null>;
/**
 * Get project by ID
 */
export declare function getProject(teamId: string, projectId: string): Promise<Project | null>;
/**
 * Clear tenant cache (useful for testing or config updates)
 */
export declare function clearTenantCache(): void;
/**
 * Invalidate specific tenant cache
 */
export declare function invalidateTenantCache(channelId: string): void;
//# sourceMappingURL=tenant.service.d.ts.map