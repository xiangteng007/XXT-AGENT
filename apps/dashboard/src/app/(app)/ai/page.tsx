'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAIChat, useMarketOutlook } from '@/lib/hooks/useAIAnalysis';
import { getAvailableModels, setActiveModel, getActiveModel, type AIModelInfo } from '@/lib/ai/gemini-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LoadingSkeleton, EmptyState } from '@/components/shared';
import {
    Bot,
    Send,
    Trash2,
    TrendingUp,
    TrendingDown,
    Minus,
    AlertTriangle,
    Lightbulb,
    MessageCircle,
    Brain,
    BarChart3,
    Sparkles,
    Zap,
    Crown,
    Timer,
    Copy,
    Download,
    BookOpen,
    Target,
    Shield,
    Globe,
    Activity,
    PieChart,
} from 'lucide-react';

// Tier badge styling
const tierConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    latest: { icon: <Sparkles className="h-3 w-3" />, color: 'bg-purple-500', label: '最新' },
    premium: { icon: <Crown className="h-3 w-3" />, color: 'bg-amber-500', label: '進階' },
    standard: { icon: <Zap className="h-3 w-3" />, color: 'bg-blue-500', label: '標準' },
    economy: { icon: <Timer className="h-3 w-3" />, color: 'bg-green-500', label: '輕量' },
};

export default function AIAssistantPage() {
    const { messages, isLoading, sendMessage, clearMessages } = useAIChat();
    const [inputValue, setInputValue] = useState('');
    const [models, setModels] = useState<AIModelInfo[]>([]);
    const [selectedModel, setSelectedModel] = useState(getActiveModel());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load available models
    useEffect(() => {
        getAvailableModels().then(setModels);
    }, []);

    // Handle model change
    const handleModelChange = (modelId: string) => {
        setSelectedModel(modelId);
        setActiveModel(modelId);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const question = inputValue;
        setInputValue('');
        await sendMessage(question);
    };

    const quickQuestions = [
        '目前市場趨勢如何？',
        '哪些產業值得關注？',
        '給我一個投資組合建議',
        '如何設定停損點？',
    ];

    // Prompt template categories
    const [activeTemplateTab, setActiveTemplateTab] = useState('investment');

    const promptTemplates: Record<string, { icon: React.ReactNode; label: string; prompts: string[] }> = {
        investment: {
            icon: <TrendingUp className="h-3.5 w-3.5" />,
            label: '投資分析',
            prompts: [
                '分析 TSMC (2330.TW) 的基本面和技術面',
                '比較台積電和聯發科的投資價值',
                '美股科技股目前有什麼好的進場機會？',
            ],
        },
        risk: {
            icon: <Shield className="h-3.5 w-3.5" />,
            label: '風險管理',
            prompts: [
                '我的持倉集中在科技股，如何分散風險？',
                '如何設計一個攻守兼備的投資組合？',
                '在升息環境下，應該如何調整債券配置？',
            ],
        },
        research: {
            icon: <Globe className="h-3.5 w-3.5" />,
            label: '市場研究',
            prompts: [
                '2026 年半導體產業的展望如何？',
                '電動車供應鏈有哪些值得關注的個股？',
                'AI 產業鏈中，哪些公司被低估了？',
            ],
        },
        portfolio: {
            icon: <PieChart className="h-3.5 w-3.5" />,
            label: '組合優化',
            prompts: [
                '幫我設計一個穩健型的 ETF 組合',
                '如何用股債平衡策略降低波動？',
                '退休金組合應該如何配置？',
            ],
        },
        technical: {
            icon: <Activity className="h-3.5 w-3.5" />,
            label: '技術分析',
            prompts: [
                '解釋均線死亡交叉和黃金交叉的意義',
                'RSI 超買時該如何操作？',
                '如何判斷支撐和壓力位？',
            ],
        },
        macro: {
            icon: <Target className="h-3.5 w-3.5" />,
            label: '總經觀點',
            prompts: [
                '美國聯準會升息對台股的影響？',
                '日圓走弱對亞洲股市的風險',
                '全球通膨趨勢下，哪些資產可以避險？',
            ],
        },
    };

    // Export chat
    const exportChat = () => {
        if (messages.length === 0) return;
        const text = messages.map(m =>
            `[${m.timestamp.toLocaleString('zh-TW')}] ${m.role === 'user' ? '我' : 'AI'}:\n${m.content}`
        ).join('\n\n---\n\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyChat = async () => {
        if (messages.length === 0) return;
        const text = messages.map(m =>
            `${m.role === 'user' ? '我' : 'AI'}：${m.content}`
        ).join('\n\n');
        await navigator.clipboard.writeText(text);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bot className="h-6 w-6" />
                        AI 投資助理
                    </h1>
                    <p className="text-muted-foreground">Powered by Gemini</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Model Selector */}
                    <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground whitespace-nowrap">模型</Label>
                        <Select value={selectedModel} onValueChange={handleModelChange}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {models.map((model) => {
                                    const tier = tierConfig[model.tier];
                                    return (
                                        <SelectItem key={model.id} value={model.id}>
                                            <div className="flex items-center gap-2">
                                                <Badge className={`${tier.color} text-white text-[10px] px-1.5 py-0`}>
                                                    {tier.icon}
                                                </Badge>
                                                <span>{model.name}</span>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                    {messages.length > 0 && (
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" onClick={copyChat} title="複製對話">
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportChat} title="下載對話">
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={clearMessages}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                清除
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Model Description */}
            {selectedModel && models.length > 0 && (
                <div className="text-sm text-muted-foreground">
                    {models.find(m => m.id === selectedModel)?.description}
                </div>
            )}

            {/* Disclaimer */}
            <div className="p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                    AI 建議僅供參考，不構成投資建議。投資有風險，請謹慎評估並諮詢專業顧問。
                </span>
            </div>

            {/* Quick Navigation */}
            <div className="grid gap-4 md:grid-cols-2">
                <Link href="/ai/analysis">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="pt-4 flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg">
                                <Brain className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium">歷史資料分析</h3>
                                <p className="text-sm text-muted-foreground">
                                    K線圖、技術指標、AI 投資建議
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/market/heatmap">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="pt-4 flex items-center gap-4">
                            <div className="p-3 bg-green-500/10 rounded-lg">
                                <BarChart3 className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">市場熱力圖</h3>
                                <p className="text-sm text-muted-foreground">
                                    自訂版塊、產業分析、即時報價
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Chat Area */}
                <div className="lg:col-span-2">
                    <Card className="h-[600px] flex flex-col">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" />
                                對話
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <Bot className="h-12 w-12 mb-4 opacity-50" />
                                    <p className="text-center mb-4">
                                        您好！我是 AI 投資助理，可以回答您的投資問題。
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {quickQuestions.map((q, i) => (
                                            <Button
                                                key={i}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setInputValue(q);
                                                }}
                                            >
                                                {q}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            <span className="text-xs opacity-70 mt-1 block">
                                                {msg.timestamp.toLocaleTimeString('zh-TW')}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-muted rounded-lg px-4 py-2">
                                        <div className="flex items-center gap-2">
                                            <div className="animate-pulse">思考中...</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </CardContent>
                        <div className="p-4 border-t">
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="輸入您的投資問題..."
                                    disabled={isLoading}
                                    className="flex-1"
                                />
                                <Button type="submit" disabled={isLoading || !inputValue.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                    </Card>
                </div>

                {/* Prompt Templates */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                提示詞模板
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Template Tabs */}
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(promptTemplates).map(([key, cat]) => (
                                    <Button
                                        key={key}
                                        variant={activeTemplateTab === key ? 'default' : 'ghost'}
                                        size="sm"
                                        className="text-xs h-7 px-2"
                                        onClick={() => setActiveTemplateTab(key)}
                                    >
                                        {cat.icon}
                                        <span className="ml-1">{cat.label}</span>
                                    </Button>
                                ))}
                            </div>
                            {/* Template List */}
                            <div className="space-y-1.5">
                                {promptTemplates[activeTemplateTab]?.prompts.map((prompt, i) => (
                                    <button
                                        key={i}
                                        className="w-full text-left text-sm p-2.5 rounded-md hover:bg-muted transition-colors border border-transparent hover:border-border"
                                        onClick={() => {
                                            setInputValue(prompt);
                                        }}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Lightbulb className="h-4 w-4" />
                                快速分析
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => sendMessage('分析當前市場環境和投資機會')}
                                disabled={isLoading}
                            >
                                <TrendingUp className="h-4 w-4 mr-2" />
                                市場環境分析
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => sendMessage('分析我的投資組合並給出建議')}
                                disabled={isLoading}
                            >
                                <TrendingDown className="h-4 w-4 mr-2" />
                                組合健康度檢查
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => sendMessage('今日有哪些重要的市場新聞需要關注？')}
                                disabled={isLoading}
                            >
                                <Minus className="h-4 w-4 mr-2" />
                                今日重要新聞
                            </Button>
                        </CardContent>
                    </Card>

                    {/* AI Status */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">AI 模型</span>
                                <Badge variant="secondary">
                                    {models.find(m => m.id === selectedModel)?.name || selectedModel}
                                </Badge>
                            </div>
                            {messages.length > 0 && (
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-sm text-muted-foreground">對話記錄</span>
                                    <Badge variant="outline">{messages.length} 則</Badge>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
