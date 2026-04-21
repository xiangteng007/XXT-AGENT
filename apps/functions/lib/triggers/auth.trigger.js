"use strict";
/**
 * Auto-provision Superadmin on First Login
 * Firebase Auth trigger that automatically grants superadmin role
 * to users in the SUPERADMIN_EMAILS list
 *
 * Note: Using firebase-functions v1 API as auth triggers are not yet in v2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreated = void 0;
const v2_1 = require("firebase-functions/v2");
const v1_1 = require("firebase-functions/v1");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const superadmin_config_1 = require("../config/superadmin.config");
const firebaseAuth = (0, auth_1.getAuth)();
const db = (0, firestore_1.getFirestore)();
/**
 * Cloud Function triggered when a new user is created in Firebase Auth
 */
exports.onUserCreated = v1_1.auth.user().onCreate(async (user) => {
    v2_1.logger.info(`New user created: ${user.email} (${user.uid})`);
    const email = user.email?.toLowerCase();
    if (!email) {
        v2_1.logger.info('No email found for user');
        return;
    }
    // Check if this email should be a superadmin
    if ((0, superadmin_config_1.isSuperadminEmail)(email)) {
        v2_1.logger.info(`🔐 Auto-provisioning superadmin for: ${email}`);
        try {
            // Set custom claims
            await firebaseAuth.setCustomUserClaims(user.uid, {
                globalRole: 'superadmin',
            });
            v2_1.logger.info('✅ Set globalRole: superadmin');
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
            v2_1.logger.info('✅ Created Firestore user document');
            v2_1.logger.info(`🎉 Superadmin provisioned for: ${email}`);
        }
        catch (error) {
            v2_1.logger.error('Error provisioning superadmin:', error);
        }
    }
    else {
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
        v2_1.logger.info(`✅ Created regular user document for: ${email}`);
    }
});
//# sourceMappingURL=auth.trigger.js.map