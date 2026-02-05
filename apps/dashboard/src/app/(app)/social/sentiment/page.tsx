'use client';

import { useState } from 'react';
import { useSocialPosts } from '@/lib/hooks/useSocialData';
import { analyzeSentiment, analyzeSentimentBatch, extractTopics } from '@/lib/social/sentiment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared';
import chartStyles from '@/styles/charts.module.css';
import type { SocialPost, SentimentAnalysis as SentimentType } from '@/lib/social/types';
import {
    Activity,
    Smile,
    Frown,
    Meh,
    Zap,
    Globe,
    RefreshCw,
    AlertTriangle,
    TrendingUp,
    Hash,
} from 'lucide-react';

const languageLabels: Record<string, string> = {
    'zh-TW': '繁體中文',
    'zh-CN': '簡體中文',
    'en': '英文',
    'ja': '日文',
    'ko': '韓文',
    'th': '泰文',
    'vi': '越南文',
    'id': '印尼文',
};

const sentimentIcons: Record<string, React.ReactNode> = {
    positive: <Smile className="h-5 w-5 text-green-500" />,
    negative: <Frown className="h-5 w-5 text-red-500" />,
    neutral: <Meh className="h-5 w-5 text-gray-500" />,
    mixed: <Activity className="h-5 w-5 text-yellow-500" />,
};

export default function SentimentAnalysisPage() {
    const { posts, isLoading } = useSocialPosts();
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResults, setAnalysisResults] = useState<Map<string, SentimentType>>(new Map());
    const [topics, setTopics] = useState<{ topic: string; count: number; sentiment: string }[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

    const handleAnalyzeBatch = async () => {
        setAnalyzing(true);
        try {
            const toAnalyze = posts.slice(0, 20).map(p => ({ id: p.id, content: p.content }));
            const results = await analyzeSentimentBatch(toAnalyze);
            setAnalysisResults(results);

            // Extract topics
            const topicResults = await extractTopics(posts);
            setTopics(topicResults);
        } catch (error) {
            console.error('Batch analysis failed:', error);
        } finally {
            setAnalyzing(false);
        }
    };

    const getLanguageDistribution = () => {
        const langCounts: Record<string, number> = {};
        posts.forEach(p => {
            const lang = p.language || 'unknown';
            langCounts[lang] = (langCounts[lang] || 0) + 1;
        });
        return Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
    };

    const getEmotionBreakdown = () => {
        let joy = 0, anger = 0, fear = 0, sadness = 0, surprise = 0;
        let count = 0;

        analysisResults.forEach(result => {
            if (result.emotionBreakdown) {
                joy += result.emotionBreakdown.joy;
                anger += result.emotionBreakdown.anger;
                fear += result.emotionBreakdown.fear;
                sadness += result.emotionBreakdown.sadness;
                surprise += result.emotionBreakdown.surprise;
                count++;
            }
        });

        if (count === 0) return null;

        return {
            joy: joy / count,
            anger: anger / count,
            fear: fear / count,
            sadness: sadness / count,
            surprise: surprise / count,
        };
    };

    const emotions = getEmotionBreakdown();
    const languages = getLanguageDistribution();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">AI 情緒分析</h1>
                <LoadingSkeleton type="card" count={4} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="h-6 w-6" />
                        AI 情緒分析
                    </h1>
                    <p className="text-muted-foreground">
                        Gemini 驅動的多語言情緒分析
                    </p>
                </div>
                <Button onClick={handleAnalyzeBatch} disabled={analyzing}>
                    {analyzing ? (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            分析中...
                        </>
                    ) : (
                        <>
                            <Zap className="h-4 w-4 mr-2" />
                            批次分析
                        </>
                    )}
                </Button>
            </div>

            {/* Disclaimer */}
            <div className="p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                    AI 情緒分析結果僅供參考，支援繁中/簡中/英/日/韓等多語言。分析準確度受貼文內容和語言影響。
                </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Analysis Panel */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Emotion Breakdown */}
                    {emotions && (
                        <Card>
                            <CardHeader>
                                <CardTitle>情緒分布</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4 md:grid-cols-5">
                                    {[
                                        { key: 'joy', label: '喜悅', emoji: '😊', color: 'bg-green-500' },
                                        { key: 'anger', label: '憤怒', emoji: '😠', color: 'bg-red-500' },
                                        { key: 'fear', label: '恐懼', emoji: '😨', color: 'bg-purple-500' },
                                        { key: 'sadness', label: '悲傷', emoji: '😢', color: 'bg-blue-500' },
                                        { key: 'surprise', label: '驚訝', emoji: '😮', color: 'bg-yellow-500' },
                                    ].map(({ key, label, emoji, color }) => (
                                        <div key={key} className="text-center">
                                            <div className="text-2xl mb-1">{emoji}</div>
                                            <div className="text-sm font-medium">{label}</div>
                                            <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className={`${chartStyles.progressBar} ${color}`}
                                                    style={{ '--progress-width': `${(emotions[key as keyof typeof emotions] * 100)}%` } as React.CSSProperties}
                                                />
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {(emotions[key as keyof typeof emotions] * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Topics */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Hash className="h-5 w-5" />
                                熱門話題
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {topics.length > 0 ? (
                                <div className="space-y-2">
                                    {topics.map((topic, idx) => (
                                        <div key={topic.topic} className="flex items-center gap-3">
                                            <span className="w-6 text-center font-bold text-muted-foreground">
                                                {idx + 1}
                                            </span>
                                            <Badge variant="outline">{topic.topic}</Badge>
                                            {sentimentIcons[topic.sentiment]}
                                            <span className="text-sm text-muted-foreground ml-auto">
                                                ~{topic.count} 則
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    點擊「批次分析」開始提取話題
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Analysis Results */}
                    <Card>
                        <CardHeader>
                            <CardTitle>分析結果</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {analysisResults.size > 0 ? (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {posts.slice(0, 20).map(post => {
                                        const result = analysisResults.get(post.id);
                                        if (!result) return null;
                                        return (
                                            <div key={post.id} className="p-3 bg-muted/50 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    {sentimentIcons[result.label]}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm line-clamp-2">{post.content}</p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Badge variant={result.label === 'positive' ? 'default' :
                                                                result.label === 'negative' ? 'destructive' : 'secondary'}>
                                                                {result.label}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground">
                                                                分數: {result.score.toFixed(2)} | 信心: {(result.confidence * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        {result.entities.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {result.entities.slice(0, 3).map(e => (
                                                                    <Badge key={e.text} variant="outline" className="text-xs">
                                                                        {e.text}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    點擊「批次分析」開始分析貼文情緒
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Language Support */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="h-5 w-5" />
                                語言分布
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {languages.map(([lang, count]) => (
                                    <div key={lang} className="flex items-center justify-between">
                                        <span className="text-sm">
                                            {languageLabels[lang] || lang}
                                        </span>
                                        <Badge variant="secondary">{count}</Badge>
                                    </div>
                                ))}
                                {languages.length === 0 && (
                                    <p className="text-sm text-muted-foreground">無語言資料</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Supported Languages */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">支援語言</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(languageLabels).map(([code, label]) => (
                                    <Badge key={code} variant="outline" className="text-xs">
                                        {label}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Analysis Stats */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">分析統計</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">總貼文</span>
                                <span className="font-medium">{posts.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">已分析</span>
                                <span className="font-medium">{analysisResults.size}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">提取話題</span>
                                <span className="font-medium">{topics.length}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
