/**
 * Root page — minimal placeholder.
 * Actual redirect from / → /butler is handled via next.config.js redirects
 * to avoid SSG errors on Vercel (redirect() is a dynamic server function).
 */
export default function RootPage() {
    return null;
}
