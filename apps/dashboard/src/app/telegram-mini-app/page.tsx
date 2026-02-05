'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Heart, 
    Car, 
    Wallet, 
    Calendar, 
    TrendingUp, 
    Activity,
    ChevronRight,
} from 'lucide-react';

// Telegram WebApp types
declare global {
    interface Window {
        Telegram?: {
            WebApp: {
                ready: () => void;
                expand: () => void;
                close: () => void;
                MainButton: {
                    text: string;
                    color: string;
                    textColor: string;
                    isVisible: boolean;
                    show: () => void;
                    hide: () => void;
                    onClick: (callback: () => void) => void;
                };
                initDataUnsafe: {
                    user?: {
                        id: number;
                        first_name: string;
                        last_name?: string;
                        username?: string;
                    };
                };
                themeParams: {
                    bg_color?: string;
                    text_color?: string;
                    hint_color?: string;
                    link_color?: string;
                    button_color?: string;
                    button_text_color?: string;
                };
            };
        };
    }
}

interface WidgetData {
    health: {
        bmi: number;
        stepsToday: number;
        activeMinutes: number;
    };
    finance: {
        monthlyExpenses: number;
        savingsRate: number;
        transactionCount: number;
    };
    vehicle: {
        nextService: number;
        avgFuelEfficiency: number;
        totalMileage: number;
    };
}

export default function TelegramMiniApp() {
    const [user, setUser] = useState<{ name: string; id?: number } | null>(null);
    const [data, setData] = useState<WidgetData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initialize Telegram WebApp
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();

            // Get user info
            const tgUser = tg.initDataUnsafe.user;
            if (tgUser) {
                setUser({
                    name: tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''),
                    id: tgUser.id,
                });
            }
        }

        // Fetch user data (simulated for now)
        const fetchData = async () => {
            try {
                // In production, this would call the API with user.id
                setData({
                    health: {
                        bmi: 28.3,
                        stepsToday: 4520,
                        activeMinutes: 15,
                    },
                    finance: {
                        monthlyExpenses: 45000,
                        savingsRate: 22,
                        transactionCount: 47,
                    },
                    vehicle: {
                        nextService: 28,
                        avgFuelEfficiency: 12.5,
                        totalMileage: 15420,
                    },
                });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 space-y-4">
            {/* Header */}
            <div className="text-center py-4">
                <h1 className="text-xl font-bold">
                    {user ? `👋 ${user.name}` : '👋 歡迎'}
                </h1>
                <p className="text-sm text-muted-foreground">XXT Personal Butler</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
                <Card className="text-center p-3">
                    <Activity className="h-5 w-5 mx-auto text-green-500" />
                    <div className="text-lg font-bold">{data?.health.stepsToday.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">步數</div>
                </Card>
                <Card className="text-center p-3">
                    <TrendingUp className="h-5 w-5 mx-auto text-blue-500" />
                    <div className="text-lg font-bold">{data?.finance.savingsRate}%</div>
                    <div className="text-xs text-muted-foreground">儲蓄率</div>
                </Card>
                <Card className="text-center p-3">
                    <Car className="h-5 w-5 mx-auto text-orange-500" />
                    <div className="text-lg font-bold">{data?.vehicle.nextService}</div>
                    <div className="text-xs text-muted-foreground">天後保養</div>
                </Card>
            </div>

            {/* Health Widget */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-red-500" />
                            健康狀態
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-2xl font-bold">{data?.health.bmi}</div>
                            <div className="text-xs text-muted-foreground">BMI</div>
                        </div>
                        <Badge variant={data?.health.bmi && data.health.bmi < 24 ? 'default' : 'secondary'}>
                            {data?.health.bmi && data.health.bmi < 24 ? '正常' : '過重'}
                        </Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        今日活動: {data?.health.activeMinutes} / 30 分鐘
                    </div>
                </CardContent>
            </Card>

            {/* Finance Widget */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-green-500" />
                            本月財務
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-2xl font-bold">
                                ${data?.finance.monthlyExpenses.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">總支出</div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-semibold text-green-500">
                                +{data?.finance.savingsRate}%
                            </div>
                            <div className="text-xs text-muted-foreground">儲蓄率</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Vehicle Widget */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-blue-500" />
                            車輛狀態
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-sm">平均油耗</div>
                            <div className="font-semibold">{data?.vehicle.avgFuelEfficiency} km/L</div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm">總里程</div>
                            <div className="font-semibold">{data?.vehicle.totalMileage.toLocaleString()} km</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        快速操作
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="w-full">
                        💰 記帳
                    </Button>
                    <Button variant="outline" size="sm" className="w-full">
                        🏃 記錄運動
                    </Button>
                    <Button variant="outline" size="sm" className="w-full">
                        ⛽ 加油記錄
                    </Button>
                    <Button variant="outline" size="sm" className="w-full">
                        📅 新增事件
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
