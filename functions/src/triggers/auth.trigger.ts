/**
 * Auto-provision Superadmin on First Login
 * Firebase Auth trigger that automatically grants superadmin role
 * to users in the SUPERADMIN_EMAILS list
 * 
 * Note: Using firebase-functions v1 API as auth triggers are not yet in v2
 */

import { auth } from 'firebase-functions/v1';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { isSuperadminEmail } from '../config/superadmin.config';

const firebaseAuth = getAuth();
const db = getFirestore();

/**
 * Cloud Function triggered when a new user is created in Firebase Auth
 */
export const onUserCreated = auth.user().onCreate(async (user) => {
    console.log(`New user created: ${user.email} (${user.uid})`);

    const email = user.email?.toLowerCase();
    if (!email) {
        console.log('No email found for user');
        return;
    }

    // Check if this email should be a superadmin
    if (isSuperadminEmail(email)) {
        console.log(`🔐 Auto-provisioning superadmin for: ${email}`);

        try {
            // Set custom claims
            await firebaseAuth.setCustomUserClaims(user.uid, {
                globalRole: 'superadmin',
            });
            console.log('✅ Set globalRole: superadmin');

            // Create/update Firestore user document
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: email,
                displayName: user.displayName || 'System Administrator',
                photoURL: user.photoURL || null,
                globalRole: 'superadmin',
                createdAt: new Date(),
                lastLoginAt: new Date(),
            }, { merge: true });
            console.log('✅ Created Firestore user document');

            console.log(`🎉 Superadmin provisioned for: ${email}`);
        } catch (error) {
            console.error('Error provisioning superadmin:', error);
        }
    } else {
        // Regular user
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || null,
            globalRole: 'user',
            createdAt: new Date(),
            lastLoginAt: new Date(),
        }, { merge: true });
        console.log(`✅ Created regular user document for: ${email}`);
    }
});
