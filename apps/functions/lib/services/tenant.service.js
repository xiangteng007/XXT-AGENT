"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTenantByChannelId = findTenantByChannelId;
exports.getTeam = getTeam;
exports.getProject = getProject;
exports.clearTenantCache = clearTenantCache;
exports.invalidateTenantCache = invalidateTenantCache;
const firebase_1 = require("../config/firebase");
// Cache tenant configs
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
/**
 * Find tenant configuration by LINE Channel ID
 */
async function findTenantByChannelId(channelId) {
    // Check cache first
    const cacheKey = `channel:${channelId}`;
    const cached = tenantCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached.config;
    }
    const db = (0, firebase_1.getDb)();
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
            console.warn(`No integration found for channel: ${channelId}`);
            return null;
        }
        const integration = {
            id: integrationsSnapshot.docs[0].id,
            ...integrationsSnapshot.docs[0].data(),
        };
        // Get team
        const teamDoc = await db.collection('teams').doc(integration.teamId).get();
        if (!teamDoc.exists) {
            console.error(`Team not found: ${integration.teamId}`);
            return null;
        }
        const team = { id: teamDoc.id, ...teamDoc.data() };
        // Get active project for this team
        const projectsSnapshot = await db
            .collection('teams')
            .doc(integration.teamId)
            .collection('projects')
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (projectsSnapshot.empty) {
            console.warn(`No active project for team: ${integration.teamId}`);
            return null;
        }
        const project = {
            id: projectsSnapshot.docs[0].id,
            ...projectsSnapshot.docs[0].data(),
        };
        const config = {
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
    }
    catch (error) {
        console.error('Error finding tenant:', error);
        return null;
    }
}
/**
 * Get team by ID
 */
async function getTeam(teamId) {
    const db = (0, firebase_1.getDb)();
    const doc = await db.collection('teams').doc(teamId).get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() };
}
/**
 * Get project by ID
 */
async function getProject(teamId, projectId) {
    const db = (0, firebase_1.getDb)();
    const doc = await db
        .collection('teams')
        .doc(teamId)
        .collection('projects')
        .doc(projectId)
        .get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() };
}
/**
 * Clear tenant cache (useful for testing or config updates)
 */
function clearTenantCache() {
    tenantCache.clear();
}
/**
 * Invalidate specific tenant cache
 */
function invalidateTenantCache(channelId) {
    tenantCache.delete(`channel:${channelId}`);
}
//# sourceMappingURL=tenant.service.js.map