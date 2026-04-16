import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env['GOOGLE_CLOUD_PROJECT'] || 'xxt-agent-dev'
    });
}
const db = admin.firestore();

async function cleanupCollection(collectionName: string, timeField: string, cutoffMs: number) {
    const cutoffDate = new Date(cutoffMs);
    console.log(`[CLEANUP] Scanning ${collectionName} for documents older than ${cutoffDate.toISOString()}...`);
    
    // Convert to Firestore Timestamp or use string depending on schema.
    // Assuming mostly ISO strings, or Timestamps. 
    // We will do a generic query (this might require index).
    const snapshot = await db.collection(collectionName)
       .where(timeField, '<', cutoffDate)
       .limit(500)
       .get();

    if (snapshot.empty) {
        console.log(`[CLEANUP] No expired documents found in ${collectionName}.`);
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`[CLEANUP] Successfully deleted ${snapshot.size} expired documents from ${collectionName}.`);
}

async function runCleanups() {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    
    try {
        // sessions: 30 days
        await cleanupCollection('sessions', 'createdAt', now - (30 * DAY_MS));
        
        // write_requests: 90 days
        await cleanupCollection('write_requests', 'created_at', now - (90 * DAY_MS));
        
        // reconciliation_history: 365 days
        await cleanupCollection('reconciliation_history', 'executed_at', now - (365 * DAY_MS));
        
    } catch (e) {
        console.error("Cleanup failed:", e);
    }
}

runCleanups();
