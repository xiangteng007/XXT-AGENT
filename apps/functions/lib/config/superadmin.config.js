"use strict";
/**
 * Superadmin Configuration
 * Define system administrators by email
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPERADMIN_EMAILS = void 0;
exports.isSuperadminEmail = isSuperadminEmail;
exports.SUPERADMIN_EMAILS = [
    'xiangteng007@gmail.com',
];
/**
 * Check if an email is a superadmin
 */
function isSuperadminEmail(email) {
    return exports.SUPERADMIN_EMAILS.includes(email.toLowerCase());
}
//# sourceMappingURL=superadmin.config.js.map