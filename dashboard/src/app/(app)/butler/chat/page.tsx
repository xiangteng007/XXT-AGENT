'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    MessageSquare,
    Send,
    ArrowLeft,
    Sparkles,
    User,
    Bot,
    Heart,
    Car,
    Wallet,
    Calendar,
} from 'lucide-react';

type Message = {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
};

const quickActions = [
    { icon: <Heart className="h-4 w-4" />, label: '今日健康', prompt: '我今天的健康狀態如何？' },
    { icon: <Car className="h-4 w-4" />, label: '車輛狀態', prompt: '我的車需要保養嗎？' },
    { icon: <Wallet className="h-4 w-4" />, label: '財務摘要', prompt: '幫我總結這個月的支出' },
    { icon: <Calendar className="h-4 w-4" />, label: '今日行程', prompt: '今天有什麼行程？' },
];

const initialMessages: Message[] = [
    {
        id: 1,
        role: 'assistant',
        content: '您好！我是您的個人管家小秘書 ✨\n\n我可以幫您管理：\n• 🏥 健康追蹤（BMI、運動、飲食）\n• 🚗 車輛管理（油耗、保養提醒）\n• 💰 財務分析（支出、帳單）\n• 📅 行程安排\n\n請問有什麼需要幫忙的嗎？',
        timestamp: new Date(),
    },
];

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now(),
            role: 'user',
            content,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Simulate AI response
        setTimeout(() => {
            const responses: { [key: string]: string } = {
                '今日健康': '📊 今日健康報告：\n\n• BMI: 28.3 (過重)\n• 目標體重: 75 kg（還需減 6.8 kg）\n• 今日步數: 6,500 步\n• 建議: 今天天氣不錯，可以去快走 30 分鐘消耗約 180 卡路里！',
                '車輛': '🚗 車輛狀態報告：\n\n• 車型: Suzuki Jimny JB74\n• 總里程: 15,680 km\n• 平均油耗: 8.2 L/100km\n• 下次保養: 還剩 4,320 km（預計 2026-03-15）\n\n狀態良好，暫無需要特別注意的維修項目。',
                '財務': '💰 本月財務摘要：\n\n• 總資產: NT$152,800\n• 本月收入: +NT$65,000\n• 本月支出: -NT$45,200\n• 儲蓄率: 30.5%\n\n⚠️ 提醒：中信信用卡帳單 NT$15,800 將於 2/10 到期。',
                '行程': '📅 今日行程：\n\n1. 14:00 - 15:00 團隊會議 @ 會議室 A\n2. 18:00 - 19:30 健身房 @ 健身工廠\n3. 21:00 - 22:00 閱讀時間 @ 家\n\n接下來最近的提醒是信用卡繳款（2/10）。',
            };

            let response = '收到！讓我為您查詢相關資訊...\n\n';
            
            if (content.includes('健康')) {
                response = responses['今日健康'];
            } else if (content.includes('車') || content.includes('保養')) {
                response = responses['車輛'];
            } else if (content.includes('財') || content.includes('支出') || content.includes('帳')) {
                response = responses['財務'];
            } else if (content.includes('行程') || content.includes('今天')) {
                response = responses['行程'];
            } else {
                response = `我理解您的問題：「${content}」\n\n這個功能正在開發中，目前我可以協助：\n• 健康追蹤查詢\n• 車輛狀態報告\n• 財務摘要分析\n• 行程提醒\n\n請嘗試詢問這些相關問題！`;
            }

            const assistantMessage: Message = {
                id: Date.now(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
            setIsLoading(false);
        }, 1000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/butler">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20">
                        <Sparkles className="h-6 w-6 text-gold" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">AI 管家對話</h1>
                        <p className="text-muted-foreground">智能助理 · Gemini 驅動</p>
                    </div>
                </div>
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                    線上
                </Badge>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {quickActions.map((action, i) => (
                    <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => sendMessage(action.prompt)}
                    >
                        {action.icon}
                        <span className="ml-2">{action.label}</span>
                    </Button>
                ))}
            </div>

            {/* Messages */}
            <Card className="flex-1 overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="h-full overflow-y-auto p-4">
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <div className={`p-2 rounded-lg shrink-0 ${
                                    message.role === 'user' 
                                        ? 'bg-blue-500/20' 
                                        : 'bg-gold/20'
                                }`}>
                                    {message.role === 'user' ? (
                                        <User className="h-5 w-5 text-blue-400" />
                                    ) : (
                                        <Bot className="h-5 w-5 text-gold" />
                                    )}
                                </div>
                                <div className={`max-w-[80%] p-3 rounded-lg ${
                                    message.role === 'user'
                                        ? 'bg-blue-500/10 border border-blue-500/20'
                                        : 'bg-muted/50'
                                }`}>
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {message.timestamp.toLocaleTimeString('zh-TW', { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="p-2 rounded-lg bg-gold/20">
                                    <Bot className="h-5 w-5 text-gold" />
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-gold animate-bounce" />
                                        <div className="w-2 h-2 rounded-full bg-gold animate-bounce delay-100" />
                                        <div className="w-2 h-2 rounded-full bg-gold animate-bounce delay-200" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </CardContent>
            </Card>

            {/* Input */}
            <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="輸入訊息..."
                    disabled={isLoading}
                    className="flex-1"
                />
                <Button type="submit" disabled={!input.trim() || isLoading}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
    );
}
