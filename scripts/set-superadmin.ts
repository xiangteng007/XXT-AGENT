/**
 * Set System Superadmin Script
 * Sets xiangteng007@gmail.com as the system owner with highest privileges
 * 
 * Usage: cd functions && npx ts-node ../scripts/set-superadmin.ts
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin with application default credentials
// This uses GOOGLE_APPLICATION_CREDENTIALS env var or gcloud auth
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xxt-agent',
    });
}

const auth = admin.auth();
const db = admin.firestore();

const SUPERADMIN_EMAIL = 'xiangteng007@gmail.com';

async function setSuperadmin() {
    console.log('🔐 Setting up system superadmin...');
    console.log(`   Email: ${SUPERADMIN_EMAIL}`);

    try {
        // Get user by email
        const userRecord = await auth.getUserByEmail(SUPERADMIN_EMAIL);
        console.log(`✅ Found user: ${userRecord.uid}`);

        // Set custom claims
        await auth.setCustomUserClaims(userRecord.uid, {
            globalRole: 'superadmin',
        });
        console.log('✅ Set globalRole: superadmin in Firebase Auth Custom Claims');

        // Update Firestore user document
        await db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: SUPERADMIN_EMAIL,
            displayName: userRecord.displayName || 'System Administrator',
            photoURL: userRecord.photoURL || null,
            globalRole: 'superadmin',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log('✅ Updated Firestore user document');

        console.log('\n🎉 Superadmin setup complete!');
        console.log('   The user will need to log out and log back in for changes to take effect.');

    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.error('❌ User not found. The user must first log in with Google to create an account.');
            console.log('\nNext steps:');
            console.log('1. User logs in to the dashboard with Google');
            console.log('2. Run this script again');
        } else {
            console.error('❌ Error:', error.message);
            console.error(error);
        }
        process.exit(1);
    }

    process.exit(0);
}

setSuperadmin();
