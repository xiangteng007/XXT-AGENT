'use client';

import { useState, useEffect } from 'react';
import { useSettings, type DataMode } from '@/lib/store/settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Settings as SettingsIcon,
    Database,
    Globe,
    Palette,
    Bell,
    Save,
    RotateCcw,
} from 'lucide-react';

export default function SettingsPage() {
    const { settings, updateSettings, resetSettings } = useSettings();
    const [localSettings, setLocalSettings] = useState(settings);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleDataModeChange = (checked: boolean) => {
        setLocalSettings({
            ...localSettings,
            dataMode: checked ? 'live' : 'mock',
        });
    };

    const handleApiUrlChange = (url: string) => {
        setLocalSettings({
            ...localSettings,
            apiBaseUrl: url,
        });
    };

    const handleSidebarCollapsedChange = (checked: boolean) => {
        setLocalSettings({
            ...localSettings,
            uiPreferences: {
                ...localSettings.uiPreferences,
                sidebarCollapsed: checked,
            },
        });
    };

    const handleCompactTableChange = (checked: boolean) => {
        setLocalSettings({
            ...localSettings,
            uiPreferences: {
                ...localSettings.uiPreferences,
                compactTable: checked,
            },
        });
    };

    const handleSave = () => {
        updateSettings(localSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        const defaults = resetSettings();
        setLocalSettings(defaults);
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold">設定</h1>
                <p className="text-muted-foreground">管理儀表板偏好設定</p>
            </div>

            {/* Data Mode */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        資料模式
                    </CardTitle>
                    <CardDescription>
                        選擇使用模擬資料或連接即時 API
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium">Live Mode</div>
                            <div className="text-xs text-muted-foreground">
                                啟用後將從 API 取得即時資料，失敗時自動回退到模擬資料
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Mock</span>
                            <Switch
                                checked={localSettings.dataMode === 'live'}
                                onCheckedChange={handleDataModeChange}
                            />
                            <span className="text-sm text-muted-foreground">Live</span>
                        </div>
                    </div>

                    {localSettings.dataMode === 'live' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">API Base URL</label>
                            <Input
                                value={localSettings.apiBaseUrl}
                                onChange={(e) => handleApiUrlChange(e.target.value)}
                                placeholder="https://api.example.com"
                            />
                            <p className="text-xs text-muted-foreground">
                                若 API 請求失敗，系統會自動使用模擬資料作為備援
                            </p>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <Badge variant={localSettings.dataMode === 'mock' ? 'secondary' : 'default'}>
                            {localSettings.dataMode === 'mock' ? 'Mock Mode' : 'Live Mode'}
                        </Badge>
                        {localSettings.dataMode === 'live' && !localSettings.apiBaseUrl && (
                            <Badge variant="destructive">未設定 API URL</Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* UI Preferences */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        介面偏好
                    </CardTitle>
                    <CardDescription>
                        自訂儀表板外觀設定
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium">側邊欄預設收合</div>
                            <div className="text-xs text-muted-foreground">
                                開啟時側邊欄預設為收合狀態
                            </div>
                        </div>
                        <Switch
                            checked={localSettings.uiPreferences.sidebarCollapsed}
                            onCheckedChange={handleSidebarCollapsedChange}
                        />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium">緊湊表格</div>
                            <div className="text-xs text-muted-foreground">
                                減少表格列的間距以顯示更多資料
                            </div>
                        </div>
                        <Switch
                            checked={localSettings.uiPreferences.compactTable}
                            onCheckedChange={handleCompactTableChange}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Notification Targets */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        通知目標
                    </CardTitle>
                    <CardDescription>
                        已設定的通知管道（唯讀）
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Telegram Chat</span>
                        </div>
                        <Badge variant="secondary">***7890</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">LINE Notify</span>
                        </div>
                        <Badge variant="outline" className="text-green-500">已啟用</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Webhook</span>
                        </div>
                        <Badge variant="outline" className="text-muted-foreground">未設定</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        通知目標設定需透過環境變數進行配置
                    </p>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    重設為預設值
                </Button>
                <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    {saved ? '已儲存 ✓' : '儲存設定'}
                </Button>
            </div>
        </div>
    );
}
