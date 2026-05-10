/**
 * (app) Route Group — Executive Dashboard
 * 
 * Server Component wrapper that imports the client dashboard.
 * This pattern ensures page_client-reference-manifest.js is properly
 * generated during Next.js build, preventing ENOENT on Vercel deployment.
 */
import ExecutiveDashboard from './ExecutiveDashboard';

export default function DashboardPage() {
    return <ExecutiveDashboard />;
}
