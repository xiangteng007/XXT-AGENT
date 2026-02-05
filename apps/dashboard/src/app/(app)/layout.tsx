import AppLayoutClient from './AppLayoutClient';
import '@/styles/appshell.css';

// Force dynamic rendering for all pages under (app) route group
// This prevents static generation errors from AuthContext/Firebase
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return <AppLayoutClient>{children}</AppLayoutClient>;
}
