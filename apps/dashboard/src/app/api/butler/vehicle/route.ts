/**
 * GET /api/butler/vehicle - Vehicle dashboard with fuel & maintenance
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const uid = auth.user.uid;

        // Vehicle profile
        const vehicleSnap = await db.doc(`users/${uid}/vehicles/default`).get();
        const vehicle = vehicleSnap.exists ? vehicleSnap.data() : null;

        // Recent fuel logs (last 10)
        const fuelSnap = await db.collection(`users/${uid}/vehicles/default/fuel_logs`)
            .orderBy('date', 'desc')
            .limit(10)
            .get();

        const fuelLogs = fuelSnap.docs.map(d => ({
            id: d.id,
            date: d.data().date,
            liters: d.data().liters,
            pricePerLiter: d.data().pricePerLiter,
            totalCost: d.data().totalCost || (d.data().liters || 0) * (d.data().pricePerLiter || 0),
            mileage: d.data().mileage,
            kmPerLiter: d.data().kmPerLiter,
        }));

        // Maintenance schedule
        const maintSnap = await db.collection(`users/${uid}/vehicles/default/maintenance`)
            .orderBy('dueDate', 'asc')
            .limit(5)
            .get();

        const maintenance = maintSnap.docs.map(d => ({
            id: d.id,
            type: d.data().type,
            description: d.data().description,
            dueDate: d.data().dueDate,
            dueMileage: d.data().dueMileage,
            completed: d.data().completed || false,
        }));

        // Calculate avg fuel efficiency
        let avgKmPerLiter: number | null = null;
        const efficiencies = fuelLogs.filter(f => f.kmPerLiter && f.kmPerLiter > 0);
        if (efficiencies.length > 0) {
            avgKmPerLiter = Math.round(
                efficiencies.reduce((s, f) => s + f.kmPerLiter, 0) / efficiencies.length * 10
            ) / 10;
        }

        return NextResponse.json({
            vehicle: vehicle ? {
                make: vehicle.make || 'Suzuki',
                model: vehicle.model || 'Jimny',
                variant: vehicle.variant || 'JB74',
                year: vehicle.year,
                licensePlate: vehicle.licensePlate || '---',
                currentMileage: vehicle.currentMileage || 0,
            } : null,
            fuelLogs,
            maintenance,
            avgKmPerLiter,
        });
    } catch (error) {
        console.error('Butler vehicle error:', error);
        return NextResponse.json({ error: 'Failed to load vehicle data' }, { status: 500 });
    }
}
