/**
 * Auto-provision Superadmin on First Login
 * Firebase Auth trigger that automatically grants superadmin role
 * to users in the SUPERADMIN_EMAILS list
 *
 * Note: Using firebase-functions v1 API as auth triggers are not yet in v2
 */
/**
 * Cloud Function triggered when a new user is created in Firebase Auth
 */
export declare const onUserCreated: import("firebase-functions/v1").CloudFunction<import("firebase-admin/auth").UserRecord>;
//# sourceMappingURL=auth.trigger.d.ts.map