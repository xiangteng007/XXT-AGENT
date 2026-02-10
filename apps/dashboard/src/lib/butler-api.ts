/**
 * Butler Client API (#18)
 * 
 * Server-side data fetching utilities for butler dashboard pages.
 * Used by Server Components or Server Actions to fetch data from the Butler API.
 */

const BUTLER_API_URL = process.env.NEXT_PUBLIC_BUTLER_API_URL || 
    'https://asia-east1-xxt-agent.cloudfunctions.net/butlerApi';

interface FetchOptions {
    token: string;
    revalidate?: number;
}

/**
 * Fetch data from Butler API with server-side caching.
 * Use in Server Components for SSR with ISR-style revalidation.
 */
export async function fetchButlerData<T>(
    path: string,
    options: FetchOptions
): Promise<T | null> {
    try {
        const response = await fetch(`${BUTLER_API_URL}/${path}`, {
            headers: {
                'Authorization': `Bearer ${options.token}`,
                'Content-Type': 'application/json',
            },
            next: { revalidate: options.revalidate ?? 60 }, // Cache for 60s by default
        });

        if (!response.ok) {
            console.error(`[Butler API] ${path} responded with ${response.status}`);
            return null;
        }

        return response.json() as Promise<T>;
    } catch (error) {
        console.error(`[Butler API] Failed to fetch ${path}:`, error);
        return null;
    }
}

/**
 * Fetch health summary for SSR.
 */
export async function fetchHealthSummary(token: string) {
    return fetchButlerData<{
        bmi: number;
        weight: number;
        todayCalories: number;
        targetCalories: number;
    }>('health/dashboard', { token, revalidate: 30 });
}

/**
 * Fetch finance summary for SSR.
 */
export async function fetchFinanceSummary(token: string) {
    return fetchButlerData<{
        totalBalance: number;
        monthlyExpense: number;
        pendingBills: number;
    }>('finance/summary', { token, revalidate: 60 });
}

/**
 * Fetch vehicle summary for SSR.
 */
export async function fetchVehicleSummary(token: string) {
    return fetchButlerData<{
        name: string;
        totalKm: number;
        avgFuelConsumption: number;
        nextMaintenance: string;
    }>('vehicle/dashboard', { token, revalidate: 120 });
}
