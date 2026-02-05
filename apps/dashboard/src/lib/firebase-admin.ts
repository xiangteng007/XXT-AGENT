/**
 * Firebase Admin SDK initialization
 * Used for: Server-side Firestore operations in Route Handlers
 */
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

function getAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
        throw new Error('Missing Firebase Admin credentials in environment variables');
    }

    adminApp = initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });

    return adminApp;
}

export function getAdminAuth() {
    return getAuth(getAdminApp());
}

export function getAdminDb() {
    return getFirestore(getAdminApp());
}

export { getAdminApp };
