import { logger } from 'firebase-functions/v2';
import { getDb } from '../config/firebase';
import { Team, Project, Integration, TenantConfig } from '../models';

// Cache tenant configs
const tenantCache = new Map<string, { config: TenantConfig; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Find tenant configuration by LINE Channel ID
 */
export async function findTenantByChannelId(
    channelId: string
): Promise<TenantConfig | null> {
    // Check cache first
    const cacheKey = `channel:${channelId}`;
    const cached = tenantCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached.config;
    }

    const db = getDb();

    try {
        // Find integration by LINE channel ID
        const integrationsSnapshot = await db
            .collection('integrations')
            .where('type', '==', 'line')
            .where('line.channelId', '==', channelId)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (integrationsSnapshot.empty) {
            logger.warn(`No integration found for channel: ${channelId}`);
            return null;
        }

        const integration = {
            id: integrationsSnapshot.docs[0].id,
            ...integrationsSnapshot.docs[0].data(),
        } as Integration;

        // Get team
        const teamDoc = await db.collection('teams').doc(integration.teamId).get();
        if (!teamDoc.exists) {
            logger.error(`Team not found: ${integration.teamId}`);
            return null;
        }
        const team = { id: teamDoc.id, ...teamDoc.data() } as Team;

        // Get active project for this team
        const projectsSnapshot = await db
            .collection('teams')
            .doc(integration.teamId)
            .collection('projects')
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (projectsSnapshot.empty) {
            logger.warn(`No active project for team: ${integration.teamId}`);
            return null;
        }

        const project = {
            id: projectsSnapshot.docs[0].id,
            ...projectsSnapshot.docs[0].data(),
        } as Project;

        const config: TenantConfig = {
            teamId: team.id,
            projectId: project.id,
            integrationId: integration.id,
            notionIntegrationId: project.notionIntegrationId,
            settings: team.settings,
        };

        // Cache the result
        tenantCache.set(cacheKey, {
            config,
            expiry: Date.now() + CACHE_TTL,
        });

        return config;

    } catch (error) {
        logger.error('Error finding tenant:', error);
        return null;
    }
}

/**
 * Get team by ID
 */
export async function getTeam(teamId: string): Promise<Team | null> {
    const db = getDb();

    const doc = await db.collection('teams').doc(teamId).get();
    if (!doc.exists) {
        return null;
    }

    return { id: doc.id, ...doc.data() } as Team;
}

/**
 * Get project by ID
 */
export async function getProject(
    teamId: string,
    projectId: string
): Promise<Project | null> {
    const db = getDb();

    const doc = await db
        .collection('teams')
        .doc(teamId)
        .collection('projects')
        .doc(projectId)
        .get();

    if (!doc.exists) {
        return null;
    }

    return { id: doc.id, ...doc.data() } as Project;
}

/**
 * Clear tenant cache (useful for testing or config updates)
 */
export function clearTenantCache(): void {
    tenantCache.clear();
}

/**
 * Invalidate specific tenant cache
 */
export function invalidateTenantCache(channelId: string): void {
    tenantCache.delete(`channel:${channelId}`);
}
