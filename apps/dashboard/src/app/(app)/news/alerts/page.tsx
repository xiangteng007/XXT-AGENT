'use client';

import { useState } from 'react';
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
    MessageCircle,
    Mail,
} from 'lucide-react';

interface NewsAlertRule {
    id: string;
    name: string;
    enabled: boolean;
    keywords: string[];
    symbols: string[];
    minSeverity: number;
    channels: { telegram: boolean; line: boolean; email: boolean };
    cooldownMinutes: number;
    triggerCount: number;
}

// Mock data
const mockAlerts: NewsAlertRule[] = [
    {
        id: '1',
        name: '重大財報警報',
        enabled: true,
        keywords: ['財報', '營收', '獲利'],
        symbols: ['AAPL', 'TSLA', 'NVDA'],
        minSeverity: 70,
        channels: { telegram: true, line: true, email: false },
        cooldownMinutes: 30,
        triggerCount: 15,
    },
    {
        id: '2',
        name: '監管政策追蹤',
        enabled: true,
        keywords: ['SEC', 'Fed', '升息', '降息'],
        symbols: [],
        minSeverity: 60,
        channels: { telegram: true, line: false, email: true },
        cooldownMinutes: 60,
        triggerCount: 8,
    },
    {
        id: '3',
        name: '加密貨幣新聞',
        enabled: false,
        keywords: ['Bitcoin', 'ETH', '加密貨幣'],
        symbols: ['BTC-USD', 'ETH-USD'],
        minSeverity: 50,
        channels: { telegram: true, line: false, email: false },
        cooldownMinutes: 15,
        triggerCount: 42,
    },
];

export default function NewsAlertsPage() {
    const [alerts, setAlerts] = useState<NewsAlertRule[]>(mockAlerts);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formKeywords, setFormKeywords] = useState('');
    const [formSymbols, setFormSymbols] = useState('');
    const [formSeverity, setFormSeverity] = useState('50');
    const [formChannels, setFormChannels] = useState({ telegram: true, line: false, email: false });
    const [formCooldown, setFormCooldown] = useState('30');

    const handleToggle = (id: string) => {
        setAlerts(prev => prev.map(a =>
            a.id === id ? { ...a, enabled: !a.enabled } : a
        ));
    };

    const handleDelete = (id: string) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    const handleSave = () => {
        const newAlert: NewsAlertRule = {
            id: editingId || Date.now().toString(),
            name: formName,
            enabled: true,
            keywords: formKeywords.split(',').map(k => k.trim()).filter(Boolean),
            symbols: formSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
            minSeverity: parseInt(formSeverity),
            channels: formChannels,
            cooldownMinutes: parseInt(formCooldown),
            triggerCount: 0,
        };

        if (editingId) {
            setAlerts(prev => prev.map(a => a.id === editingId ? newAlert : a));
        } else {
            setAlerts(prev => [...prev, newAlert]);
        }

        resetForm();
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormName('');
        setFormKeywords('');
        setFormSymbols('');
        setFormSeverity('50');
        setFormChannels({ telegram: true, line: false, email: false });
        setFormCooldown('30');
    };

    const handleEdit = (alert: NewsAlertRule) => {
        setEditingId(alert.id);
        setFormName(alert.name);
        setFormKeywords(alert.keywords.join(', '));
        setFormSymbols(alert.symbols.join(', '));
        setFormSeverity(alert.minSeverity.toString());
        setFormChannels(alert.channels);
        setFormCooldown(alert.cooldownMinutes.toString());
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
                        新聞警報設定
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
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="form-name">警報名稱</Label>
                                <Input
                                    id="form-name"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="例：重大財報警報"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="form-keywords">關鍵字 (逗號分隔)</Label>
                                <Input
                                    id="form-keywords"
                                    value={formKeywords}
                                    onChange={(e) => setFormKeywords(e.target.value)}
                                    placeholder="財報, 營收, 獲利"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="form-symbols">標的代號 (逗號分隔)</Label>
                                <Input
                                    id="form-symbols"
                                    value={formSymbols}
                                    onChange={(e) => setFormSymbols(e.target.value)}
                                    placeholder="AAPL, TSLA, NVDA"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="form-severity">最低嚴重度</Label>
                                <Select value={formSeverity} onValueChange={setFormSeverity}>
                                    <SelectTrigger id="form-severity">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="30">30 - 低</SelectItem>
                                        <SelectItem value="50">50 - 中</SelectItem>
                                        <SelectItem value="70">70 - 高</SelectItem>
                                        <SelectItem value="90">90 - 緊急</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="form-cooldown">冷卻時間</Label>
                                <Select value={formCooldown} onValueChange={setFormCooldown}>
                                    <SelectTrigger id="form-cooldown">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="15">15 分鐘</SelectItem>
                                        <SelectItem value="30">30 分鐘</SelectItem>
                                        <SelectItem value="60">1 小時</SelectItem>
                                        <SelectItem value="120">2 小時</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>通知渠道</Label>
                                <div className="flex gap-4">
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
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSave}>
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
            <div className="space-y-4">
                {alerts.map(alert => (
                    <Card key={alert.id} className={alert.enabled ? '' : 'opacity-60'}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold">{alert.name}</h3>
                                        <Switch
                                            checked={alert.enabled}
                                            onCheckedChange={() => handleToggle(alert.id)}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            已觸發 {alert.triggerCount} 次
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {alert.keywords.map(k => (
                                            <Badge key={k} variant="outline">{k}</Badge>
                                        ))}
                                        {alert.symbols.map(s => (
                                            <Badge key={s} variant="secondary">{s}</Badge>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>嚴重度 ≥ {alert.minSeverity}</span>
                                        <span>冷卻 {alert.cooldownMinutes} 分鐘</span>
                                        <div className="flex items-center gap-2">
                                            {alert.channels.telegram && <MessageCircle className="h-4 w-4" />}
                                            {alert.channels.line && <MessageCircle className="h-4 w-4 text-green-500" />}
                                            {alert.channels.email && <Mail className="h-4 w-4" />}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
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
                    <p className="text-muted-foreground">尚無警報規則</p>
                </div>
            )}
        </div>
    );
}
