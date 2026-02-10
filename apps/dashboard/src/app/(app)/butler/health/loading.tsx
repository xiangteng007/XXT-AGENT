import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Health page loading skeleton (#18)
 */
export default function HealthLoading() {
    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-10 w-28" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="pt-6 space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-8 w-28" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardContent className="pt-6">
                    <Skeleton className="h-64 w-full rounded-lg" />
                </CardContent>
            </Card>
        </div>
    );
}
