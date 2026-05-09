'use client';

import { LoadingSkeleton } from '@/components/shared';

export default function SocialLoading() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">社群監控</h1>
                <p className="text-muted-foreground">即時社群動態與情緒分析</p>
            </div>
            <LoadingSkeleton type="card" count={6} />
        </div>
    );
}
