'use client';

import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function LogsPage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="border-border/50 bg-card/50 max-w-md">
                <CardContent className="pt-6 text-center space-y-4">
                    <Construction className="h-12 w-12 text-gold mx-auto" />
                    <h1 className="text-xl font-semibold">系統日誌</h1>
                    <p className="text-muted-foreground text-sm">
                        此功能正在開發中，敬請期待。
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
