"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.app = void 0;
exports.initializeFirebase = initializeFirebase;
exports.getDb = getDb;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
let app;
let db;
/**
 * Initialize Firebase Admin SDK
 * Uses Application Default Credentials in production
 */
function initializeFirebase() {
    if ((0, app_1.getApps)().length === 0) {
        exports.app = app = (0, app_1.initializeApp)();
    }
    else {
        exports.app = app = (0, app_1.getApps)()[0];
    }
    return app;
}
/**
 * Get Firestore instance
 */
function getDb() {
    if (!db) {
        initializeFirebase();
        exports.db = db = (0, firestore_1.getFirestore)();
    }
    return db;
}
// Initialize on module load
initializeFirebase();
//# sourceMappingURL=firebase.js.map