import { redirect } from 'next/navigation';

// Agent Health Wall has been superseded by the unified Operations Center
// The main /system page now covers infrastructure health monitoring
export default function HealthRedirect() {
    redirect('/system');
}
