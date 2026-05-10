export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

/**
 * Root page redirect — sends all traffic to the main app.
 * The (app) layout handles auth checks and will redirect to /login if needed.
 */
export default function RootPage() {
    redirect('/butler');
}
