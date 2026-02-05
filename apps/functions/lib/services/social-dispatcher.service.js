"use strict";
/**
 * Social Dispatcher Service
 *
 * Triggered by Cloud Scheduler every minute.
 * Reads enabled social_sources and fans out Cloud Tasks for each source.
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
exports.dispatchSocialCollectJobs = dispatchSocialCollectJobs;
exports.getTenantsWithSources = getTenantsWithSources;
const admin = __importStar(require("firebase-admin"));
const tasks_1 = require("@google-cloud/tasks");
const error_handling_1 = require("../utils/error-handling");
const db = admin.firestore();
const tasksClient = new tasks_1.CloudTasksClient();
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
const LOCATION = process.env.FUNCTION_REGION || 'asia-east1';
const QUEUE_NAME = 'social-collect-queue';
const COLLECTOR_URL = process.env.SOCIAL_COLLECTOR_URL || '';
/**
 * Main dispatcher function
 */
async function dispatchSocialCollectJobs() {
    console.log('[Social Dispatcher] Starting dispatch cycle...');
    const result = { dispatched: 0, skipped: 0, errors: [] };
    try {
        // Fetch all enabled sources across all tenants
        const sourcesSnapshot = await db.collectionGroup('sources')
            .where('enabled', '==', true)
            .get();
        console.log(`[Social Dispatcher] Found ${sourcesSnapshot.size} enabled sources`);
        for (const doc of sourcesSnapshot.docs) {
            const source = { id: doc.id, ...doc.data() };
            // Skip if webhook mode (handled by webhook endpoint)
            if (source.mode === 'webhook') {
                result.skipped++;
                continue;
            }
            try {
                await createCollectTask(source);
                result.dispatched++;
            }
            catch (err) {
                console.error(`[Social Dispatcher] Failed to create task for ${source.id}:`, err);
                result.errors.push(`${source.id}: ${(0, error_handling_1.getErrorMessage)(err)}`);
            }
        }
        console.log('[Social Dispatcher] Dispatch complete:', result);
        return result;
    }
    catch (err) {
        console.error('[Social Dispatcher] Fatal error:', err);
        result.errors.push((0, error_handling_1.getErrorMessage)(err));
        return result;
    }
}
/**
 * Create a Cloud Task for collecting from a source
 */
async function createCollectTask(source) {
    const parent = tasksClient.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);
    const job = {
        tenantId: source.tenantId,
        sourceId: source.id,
        platform: source.platform,
        priority: 'normal',
        retryCount: 0,
        createdAt: new Date(),
    };
    const task = {
        httpRequest: {
            httpMethod: 'POST',
            url: COLLECTOR_URL,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(job)).toString('base64'),
            oidcToken: {
                serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL || '',
            },
        },
        scheduleTime: {
            seconds: Math.floor(Date.now() / 1000),
        },
    };
    await tasksClient.createTask({ parent, task });
    console.log(`[Social Dispatcher] Created task for ${source.platform}:${source.id}`);
}
/**
 * Get all tenant IDs that have social sources
 */
async function getTenantsWithSources() {
    const tenantsSnapshot = await db.collection('social_sources').listDocuments();
    return tenantsSnapshot.map(doc => doc.id);
}
//# sourceMappingURL=social-dispatcher.service.js.map