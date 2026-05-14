import { redirect } from 'next/navigation';

// LINE Bot admin has been moved to the unified System Operations Center
// Redirect for backward compatibility
export default function ButlerAdminRedirect() {
    redirect('/system/linebot');
}
