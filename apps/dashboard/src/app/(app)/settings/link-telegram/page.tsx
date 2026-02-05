'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    MessageCircle, 
    Link2, 
    CheckCircle2, 
    AlertCircle, 
    Loader2,
    ExternalLink,
} from 'lucide-react';

export default function LinkTelegramPage() {
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleCodeChange = (value: string) => {
        // Only allow digits and limit to 6 characters
        const cleaned = value.replace(/\D/g, '').slice(0, 6);
        setCode(cleaned);
    };

    const handleSubmit = async () => {
        if (code.length !== 6) {
            setStatus('error');
            setMessage('請輸入 6 位數驗證碼');
            return;
        }

        setStatus('loading');

        try {
            const response = await fetch('/api/telegram/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus('success');
                setMessage('Telegram 帳號綁定成功！');
                setCode('');
            } else {
                setStatus('error');
                setMessage(data.error || '驗證碼無效或已過期');
            }
        } catch {
            setStatus('error');
            setMessage('連線錯誤，請稍後再試');
        }
    };

    return (
        <div className="space-y-6 max-w-xl">
            <div>
                <h1 className="text-2xl font-bold">綁定 Telegram</h1>
                <p className="text-muted-foreground">將您的 Telegram 帳號與本系統連結</p>
            </div>

            {/* Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-[#0088cc]" />
                        綁定步驟
                    </CardTitle>
                    <CardDescription>
                        按照以下步驟完成 Telegram 帳號綁定
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ol className="list-decimal list-inside space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                            <span className="font-medium min-w-6">1.</span>
                            <span>
                                開啟 Telegram 並搜尋{' '}
                                <a 
                                    href="https://t.me/XXT1007_BOT" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[#0088cc] hover:underline font-medium inline-flex items-center gap-1"
                                >
                                    @XXT1007_BOT
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-medium min-w-6">2.</span>
                            <span>點擊「START」或發送 <code className="bg-muted px-1.5 py-0.5 rounded">/start</code></span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-medium min-w-6">3.</span>
                            <span>發送 <code className="bg-muted px-1.5 py-0.5 rounded">/link</code> 獲取 6 位數驗證碼</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-medium min-w-6">4.</span>
                            <span>在下方輸入驗證碼完成綁定</span>
                        </li>
                    </ol>
                </CardContent>
            </Card>

            {/* Verification Code Input */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        輸入驗證碼
                    </CardTitle>
                    <CardDescription>
                        驗證碼有效期為 10 分鐘
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            value={code}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            placeholder="000000"
                            className="text-center text-2xl font-mono tracking-widest"
                            maxLength={6}
                            disabled={status === 'loading' || status === 'success'}
                        />
                    </div>

                    {status === 'error' && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">{message}</span>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-800 border border-green-500 dark:bg-green-950 dark:text-green-300">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">{message}</span>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleSubmit}
                        disabled={code.length !== 6 || status === 'loading' || status === 'success'}
                        className="w-full"
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                驗證中...
                            </>
                        ) : status === 'success' ? (
                            <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                綁定成功
                            </>
                        ) : (
                            <>
                                <Link2 className="h-4 w-4 mr-2" />
                                確認綁定
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>

            {/* Status Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">綁定狀態</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Telegram 帳號</span>
                        {status === 'success' ? (
                            <Badge variant="default" className="bg-green-500">已綁定</Badge>
                        ) : (
                            <Badge variant="secondary">未綁定</Badge>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
