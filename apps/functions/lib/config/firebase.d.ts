import { App } from 'firebase-admin/app';
import { Firestore } from 'firebase-admin/firestore';
declare let app: App;
declare let db: Firestore;
/**
 * Initialize Firebase Admin SDK
 * Uses Application Default Credentials in production
 */
export declare function initializeFirebase(): App;
/**
 * Get Firestore instance
 */
export declare function getDb(): Firestore;
export { app, db };
//# sourceMappingURL=firebase.d.ts.map