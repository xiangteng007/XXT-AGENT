/**
 * Superadmin Configuration
 * Define system administrators by email
 */

export const SUPERADMIN_EMAILS = [
    'xiangteng007@gmail.com',
];

/**
 * Check if an email is a superadmin
 */
export function isSuperadminEmail(email: string): boolean {
    return SUPERADMIN_EMAILS.includes(email.toLowerCase());
}
