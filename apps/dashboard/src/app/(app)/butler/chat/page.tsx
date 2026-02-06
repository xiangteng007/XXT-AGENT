'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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
    Crown,
    Zap,
    Timer,
} from 'lucide-react';
import { 
    getAvailableModels, 
    setActiveModel, 
    getActiveModel, 
    chat,
    type AIModelInfo 
} from '@/lib/ai/gemini-client';

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

// Tier badge styling
const tierConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    latest: { icon: <Sparkles className="h-3 w-3" />, color: 'bg-purple-500', label: '最新' },
    premium: { icon: <Crown className="h-3 w-3" />, color: 'bg-amber-500', label: '進階' },
    standard: { icon: <Zap className="h-3 w-3" />, color: 'bg-blue-500', label: '標準' },
    economy: { icon: <Timer className="h-3 w-3" />, color: 'bg-green-500', label: '輕量' },
};

// Butler system prompt
const BUTLER_SYSTEM_PROMPT = `你是使用者的個人管家小秘書，名為「小秘書」。你的職責是協助管理使用者的日常生活，包括：

1. 🏥 健康追蹤：BMI、體重管理、運動建議、飲食記錄
2. 🚗 車輛管理：油耗追蹤、保養提醒、維修記錄
3. 💰 財務分析：支出分類、帳單提醒、預算建議
4. 📅 行程安排：日程管理、重要日期提醒

請用親切、專業的語氣回應，適當使用 emoji 讓對話更生動。
如果使用者詢問的內容超出這些範圍，你可以盡力提供幫助，但要說明你的專長領域。
回應請用繁體中文（台灣）。`;

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
    const [models, setModels] = useState<AIModelInfo[]>([]);
    const [selectedModel, setSelectedModel] = useState(getActiveModel());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
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

        try {
            // Build conversation context
            const conversationContext = messages
                .slice(-6) // Last 6 messages for context
                .map(m => `${m.role === 'user' ? '使用者' : '小秘書'}：${m.content}`)
                .join('\n\n');

            const response = await chat(content, {
                systemPrompt: BUTLER_SYSTEM_PROMPT,
                context: conversationContext,
            });

            const assistantMessage: Message = {
                id: Date.now(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = {
                id: Date.now(),
                role: 'assistant',
                content: '抱歉，我暫時無法回應。請稍後再試，或檢查網路連線。',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const currentModel = models.find(m => m.id === selectedModel);

    return (
        <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
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
                        <p className="text-muted-foreground text-sm">
                            {currentModel?.name || 'Gemini'} 驅動
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Model Selector */}
                    <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground whitespace-nowrap hidden sm:block">模型</Label>
                        <Select value={selectedModel} onValueChange={handleModelChange}>
                            <SelectTrigger className="w-[160px]">
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
                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                        線上
                    </Badge>
                </div>
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
                        disabled={isLoading}
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

