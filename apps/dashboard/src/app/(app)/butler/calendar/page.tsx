'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Calendar,
    ArrowLeft,
    Clock,
    MapPin,
    Bell,
    Loader2,
} from 'lucide-react';

interface ScheduleData {
    today: {
        date: string;
        dayLabel: string;
        events: Array<{
            id: string;
            title: string;
            startTime: string;
            endTime: string;
            location: string;
            category: string;
            allDay: boolean;
        }>;
    };
    week: {
        startDate: string;
        endDate: string;
        events: Array<{
            id: string;
            title: string;
            date: string;
            startTime: string;
            endTime: string;
            location: string;
            category: string;
        }>;
        totalCount: number;
    };
    reminders: Array<{
        id: string;
        title: string;
        dueDate: string;
    }>;
}

export default function CalendarPage() {
    const [data, setData] = useState<ScheduleData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/butler/schedule')
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/butler">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20">
                    <Calendar className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">行程管理</h1>
                    <p className="text-muted-foreground">{data?.today?.dayLabel || '今日行程'}</p>
                </div>
            </div>

            {/* Today's Events */}
            <Card className="border-purple-500/30 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-purple-400" />
                        今日行程
                        <Badge variant="outline" className="ml-2 border-purple-400/30 text-purple-400">
                            {data?.today?.events?.length ?? 0}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {data?.today?.events && data.today.events.length > 0 ? (
                        <div className="space-y-3">
                            {data.today.events.map((event) => (
                                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border-l-4 border-purple-500">
                                    <div className="flex-1">
                                        <p className="font-medium">{event.title}</p>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                            {!event.allDay && event.startTime && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                                                </span>
                                            )}
                                            {event.allDay && <span>全天</span>}
                                            {event.location && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {event.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {event.category && (
                                        <Badge variant="outline" className="text-xs">{event.category}</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            今天沒有排定行程 🎉
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* This Week */}
            {data?.week?.events && data.week.events.length > 0 && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-400" />
                            本週行程
                            <Badge variant="outline" className="ml-2">{data.week.totalCount}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.week.events.map((event) => (
                                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                    <div>
                                        <p className="font-medium">{event.title}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {event.date} {event.startTime ? `· ${event.startTime}` : ''}
                                            {event.location ? ` · ${event.location}` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Reminders */}
            {data?.reminders && data.reminders.length > 0 && (
                <Card className="border-gold/30 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-gold" />
                            待辦提醒
                            <Badge variant="outline" className="ml-2 border-gold/30 text-gold">
                                {data.reminders.length}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.reminders.map((r) => (
                                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border-l-4 border-gold">
                                    <p className="font-medium">{r.title}</p>
                                    <span className="text-sm text-muted-foreground">{r.dueDate}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
