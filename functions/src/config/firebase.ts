import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App;
let db: Firestore;

/**
 * Initialize Firebase Admin SDK
 * Uses Application Default Credentials in production
 */
export function initializeFirebase(): App {
    if (getApps().length === 0) {
        app = initializeApp();
    } else {
        app = getApps()[0];
    }
    return app;
}

/**
 * Get Firestore instance
 */
export function getDb(): Firestore {
    if (!db) {
        initializeFirebase();
        db = getFirestore();
    }
    return db;
}

// Initialize on module load
initializeFirebase();

export { app, db };
