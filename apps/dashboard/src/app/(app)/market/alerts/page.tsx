'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Bell,
    Plus,
    Trash2,
    Save,
    TrendingUp,
    TrendingDown,
    Activity,
    MessageCircle,
    Mail,
    Loader2,
    RefreshCw,
} from 'lucide-react';

type AlertType = 'price_above' | 'price_below' | 'change_pct' | 'volume_spike' | 'rsi';

interface MarketAlertRule {
    id: string;
    name: string;
    symbol: string;
    type: AlertType;
    value: number;
    enabled: boolean;
    channels: { telegram: boolean; line: boolean; email: boolean };
    triggerCount: number;
    lastTriggered?: string;
}

const alertTypeLabels: Record<AlertType, { label: string; icon: React.ReactNode; unit: string }> = {
    price_above: { label: '價格突破', icon: <TrendingUp className="h-4 w-4 text-green-500" />, unit: 'USD' },
    price_below: { label: '價格跌破', icon: <TrendingDown className="h-4 w-4 text-red-500" />, unit: 'USD' },
    change_pct: { label: '漲跌幅', icon: <Activity className="h-4 w-4 text-purple-500" />, unit: '%' },
    volume_spike: { label: '成交量異常', icon: <Activity className="h-4 w-4 text-orange-500" />, unit: 'x均量' },
    rsi: { label: 'RSI 訊號', icon: <Activity className="h-4 w-4 text-blue-500" />, unit: '' },
};

export default function MarketAlertsPage() {
    const { getIdToken } = useAuth();
    const [alerts, setAlerts] = useState<MarketAlertRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formSymbol, setFormSymbol] = useState('');
    const [formType, setFormType] = useState<AlertType>('price_above');
    const [formValue, setFormValue] = useState('');
    const [formChannels, setFormChannels] = useState({ telegram: true, line: false, email: false });

    const fetchAlerts = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/market/alerts', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const mapped = (data.rules || []).map((r: Record<string, unknown>) => ({
                    id: r.id as string,
                    name: r.name as string || '',
                    symbol: r.symbol as string || '',
                    type: (r.type as AlertType) || 'price_above',
                    value: (r.condition as Record<string, unknown>)?.value as number || 0,
                    enabled: r.enabled as boolean ?? true,
                    channels: {
                        telegram: r.notifyTelegram as boolean ?? false,
                        line: r.notifyLine as boolean ?? false,
                        email: false,
                    },
                    triggerCount: r.triggerCount as number || 0,
                    lastTriggered: r.lastTriggered as string | undefined,
                }));
                setAlerts(mapped);
            }
        } catch (err) {
            console.error('Failed to load alerts:', err);
        }
        setIsLoading(false);
    }, [getIdToken]);

    useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

    const handleToggle = (id: string) => {
        setAlerts(prev => prev.map(a =>
            a.id === id ? { ...a, enabled: !a.enabled } : a
        ));
    };

    const handleDelete = (id: string) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    const handleSave = async () => {
        const rule = {
            name: formName || `${formSymbol} ${alertTypeLabels[formType].label}`,
            symbol: formSymbol.toUpperCase(),
            type: formType,
            condition: { value: parseFloat(formValue) },
            notifyTelegram: formChannels.telegram,
            notifyLine: formChannels.line,
        };

        try {
            const token = await getIdToken();
            const res = await fetch('/api/market/alerts', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(rule),
            });
            if (res.ok) {
                await fetchAlerts(); // Reload from server
            }
        } catch (err) {
            console.error('Failed to save alert:', err);
            // Fallback: add locally
            const newAlert: MarketAlertRule = {
                id: Date.now().toString(),
                name: rule.name,
                symbol: rule.symbol,
                type: formType,
                value: parseFloat(formValue),
                enabled: true,
                channels: formChannels,
                triggerCount: 0,
            };
            setAlerts(prev => [...prev, newAlert]);
        }

        resetForm();
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormName('');
        setFormSymbol('');
        setFormType('price_above');
        setFormValue('');
        setFormChannels({ telegram: true, line: false, email: false });
    };

    const handleEdit = (alert: MarketAlertRule) => {
        setEditingId(alert.id);
        setFormName(alert.name);
        setFormSymbol(alert.symbol);
        setFormType(alert.type);
        setFormValue(alert.value.toString());
        setFormChannels(alert.channels);
        setShowForm(true);
    };

    const enabledCount = alerts.filter(a => a.enabled).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bell className="h-6 w-6" />
                        價格警報設定
                    </h1>
                    <p className="text-muted-foreground">
                        {enabledCount} / {alerts.length} 個警報已啟用
                    </p>
                </div>
                <Button onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新增警報
                </Button>
            </div>

            {/* Form */}
            {showForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingId ? '編輯警報' : '新增警報'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="alert-symbol">標的代號</Label>
                                <Input
                                    id="alert-symbol"
                                    value={formSymbol}
                                    onChange={(e) => setFormSymbol(e.target.value)}
                                    placeholder="AAPL"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="alert-type">警報類型</Label>
                                <Select value={formType} onValueChange={(v) => setFormType(v as AlertType)}>
                                    <SelectTrigger id="alert-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="price_above">價格突破</SelectItem>
                                        <SelectItem value="price_below">價格跌破</SelectItem>
                                        <SelectItem value="change_pct">漲跌幅超過</SelectItem>
                                        <SelectItem value="volume_spike">成交量倍數</SelectItem>
                                        <SelectItem value="rsi">RSI 超買/超賣</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="alert-value">觸發值 ({alertTypeLabels[formType].unit})</Label>
                                <Input
                                    id="alert-value"
                                    type="number"
                                    value={formValue}
                                    onChange={(e) => setFormValue(e.target.value)}
                                    placeholder="100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="alert-name">警報名稱 (選填)</Label>
                                <Input
                                    id="alert-name"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="自動生成"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">通知渠道:</span>
                            <label className="flex items-center gap-2">
                                <Switch
                                    checked={formChannels.telegram}
                                    onCheckedChange={(v) => setFormChannels(p => ({ ...p, telegram: v }))}
                                />
                                <span className="text-sm">Telegram</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <Switch
                                    checked={formChannels.line}
                                    onCheckedChange={(v) => setFormChannels(p => ({ ...p, line: v }))}
                                />
                                <span className="text-sm">LINE</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <Switch
                                    checked={formChannels.email}
                                    onCheckedChange={(v) => setFormChannels(p => ({ ...p, email: v }))}
                                />
                                <span className="text-sm">Email</span>
                            </label>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={!formSymbol || !formValue}>
                                <Save className="h-4 w-4 mr-2" />
                                儲存
                            </Button>
                            <Button variant="outline" onClick={resetForm}>
                                取消
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Alerts List */}
            <div className="grid gap-4 md:grid-cols-2">
                {alerts.map(alert => (
                    <Card key={alert.id} className={alert.enabled ? '' : 'opacity-60'}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        {alertTypeLabels[alert.type].icon}
                                        <Badge variant="secondary">{alert.symbol}</Badge>
                                        <Switch
                                            checked={alert.enabled}
                                            onCheckedChange={() => handleToggle(alert.id)}
                                        />
                                    </div>

                                    <h3 className="font-medium mb-1">{alert.name}</h3>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>
                                            {alertTypeLabels[alert.type].label}: {alert.value} {alertTypeLabels[alert.type].unit}
                                        </span>
                                        <span>觸發 {alert.triggerCount} 次</span>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        {alert.channels.telegram && <MessageCircle className="h-4 w-4" />}
                                        {alert.channels.line && <MessageCircle className="h-4 w-4 text-green-500" />}
                                        {alert.channels.email && <Mail className="h-4 w-4" />}
                                    </div>
                                </div>

                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(alert)}>
                                        編輯
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(alert.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {alerts.length === 0 && (
                <div className="text-center py-12">
                    <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">尚無價格警報</p>
                </div>
            )}
        </div>
    );
}
