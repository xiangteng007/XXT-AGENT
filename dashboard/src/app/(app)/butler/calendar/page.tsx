'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Calendar,
    Clock,
    Plus,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Users,
    Bell,
} from 'lucide-react';

// Mock calendar data
const calendarData = {
    today: '2026-02-05',
    currentMonth: '2026年2月',
    todayEvents: [
        { id: 1, title: '團隊會議', time: '14:00 - 15:00', location: '會議室 A', type: 'meeting' },
        { id: 2, title: '健身房', time: '18:00 - 19:30', location: '健身工廠', type: 'health' },
        { id: 3, title: '閱讀時間', time: '21:00 - 22:00', location: '家', type: 'personal' },
    ],
    upcomingEvents: [
        { id: 4, title: '車輛保養', date: '2026-03-15', type: 'vehicle' },
        { id: 5, title: '年度健檢', date: '2026-02-19', type: 'health' },
        { id: 6, title: '信用卡繳款', date: '2026-02-10', type: 'finance' },
        { id: 7, title: '專案報告', date: '2026-02-12', type: 'work' },
    ],
    monthEvents: [
        { date: 5, count: 3 },
        { date: 10, count: 1 },
        { date: 12, count: 2 },
        { date: 15, count: 1 },
        { date: 19, count: 1 },
        { date: 22, count: 2 },
    ],
};

const eventTypeConfig = {
    meeting: { color: 'bg-blue-500', textColor: 'text-blue-400', label: '會議' },
    health: { color: 'bg-emerald-500', textColor: 'text-emerald-400', label: '健康' },
    personal: { color: 'bg-purple-500', textColor: 'text-purple-400', label: '個人' },
    vehicle: { color: 'bg-orange-500', textColor: 'text-orange-400', label: '車輛' },
    finance: { color: 'bg-gold', textColor: 'text-gold', label: '財務' },
    work: { color: 'bg-pink-500', textColor: 'text-pink-400', label: '工作' },
};

export default function CalendarPage() {
    const daysInMonth = 28;
    const startDay = 6; // Saturday
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: startDay }, (_, i) => i);

    const getEventCount = (day: number) => {
        const event = calendarData.monthEvents.find(e => e.date === day);
        return event?.count || 0;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
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
                        <h1 className="text-2xl font-bold">行事曆</h1>
                        <p className="text-muted-foreground">管理您的日程與提醒</p>
                    </div>
                </div>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    新增事件
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Calendar View */}
                <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>{calendarData.currentMonth}</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="icon">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Day headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                                <div key={day} className="text-center text-sm text-muted-foreground py-2">
                                    {day}
                                </div>
                            ))}
                        </div>
                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {emptyDays.map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square" />
                            ))}
                            {days.map((day) => {
                                const eventCount = getEventCount(day);
                                const isToday = day === 5;
                                return (
                                    <div
                                        key={day}
                                        className={`aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all
                                            ${isToday ? 'bg-purple-500/20 border border-purple-500/50' : 'hover:bg-muted/50'}
                                        `}
                                    >
                                        <span className={`text-sm font-medium ${isToday ? 'text-purple-400' : ''}`}>
                                            {day}
                                        </span>
                                        {eventCount > 0 && (
                                            <div className="flex gap-0.5 mt-1">
                                                {Array.from({ length: Math.min(eventCount, 3) }).map((_, i) => (
                                                    <div key={i} className="w-1 h-1 rounded-full bg-purple-400" />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Today's Events */}
                <Card className="border-purple-500/30 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-400" />
                            今日行程
                            <Badge variant="outline" className="text-purple-400 border-purple-400/30 ml-2">
                                {calendarData.todayEvents.length}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {calendarData.todayEvents.map((event) => {
                                const config = eventTypeConfig[event.type as keyof typeof eventTypeConfig];
                                return (
                                    <div key={event.id} className="p-3 rounded-lg bg-muted/50 border-l-4 border-purple-500">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-medium">{event.title}</p>
                                            <Badge variant="outline" className={`${config.textColor} border-current/30`}>
                                                {config.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {event.time}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {event.location}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Upcoming Events */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-gold" />
                        即將到來
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        {calendarData.upcomingEvents.map((event) => {
                            const config = eventTypeConfig[event.type as keyof typeof eventTypeConfig];
                            return (
                                <div key={event.id} className="p-4 rounded-lg bg-muted/50 card-lift cursor-pointer">
                                    <div className={`w-2 h-2 rounded-full ${config.color} mb-2`} />
                                    <p className="font-medium">{event.title}</p>
                                    <p className="text-sm text-muted-foreground">{event.date}</p>
                                    <Badge variant="outline" className={`${config.textColor} border-current/30 mt-2`}>
                                        {config.label}
                                    </Badge>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
