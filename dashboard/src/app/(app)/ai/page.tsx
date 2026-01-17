'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAIChat, useMarketOutlook } from '@/lib/hooks/useAIAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

export default function AIAssistantPage() {
    const { messages, isLoading, sendMessage, clearMessages } = useAIChat();
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bot className="h-6 w-6" />
                        AI 投資助理
                    </h1>
                    <p className="text-muted-foreground">Powered by Gemini</p>
                </div>
                {messages.length > 0 && (
                    <Button variant="outline" size="sm" onClick={clearMessages}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        清除對話
                    </Button>
                )}
            </div>

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

                {/* Quick Actions */}
                <div className="space-y-4">
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

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">常見問題</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {[
                                '如何判斷買入時機？',
                                '什麼是合理的持倉比例？',
                                '如何分散投資風險？',
                                '短線與長線策略差異？',
                            ].map((q, i) => (
                                <button
                                    key={i}
                                    className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                                    onClick={() => {
                                        setInputValue(q);
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* AI Status */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">AI 模型</span>
                                <Badge variant="secondary">Gemini 1.5 Flash</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
