'use client';

import { useState } from 'react';
import { useNewsArticles, useNewsMutations } from '@/lib/hooks/useNewsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton, SeverityBadge } from '@/components/shared';
import type { NewsArticle } from '@/lib/news/types';
import {
    Sparkles,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Minus,
    Brain,
    AlertCircle,
    CheckCircle,
    ExternalLink,
    Loader2,
} from 'lucide-react';

const sentimentConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    bullish: { label: '看漲', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950' },
    bearish: { label: '看跌', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950' },
    neutral: { label: '中性', color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-950' },
    mixed: { label: '混合', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-950' },
};

export default function NewsAnalysisPage() {
    const { articles, isLoading, refresh } = useNewsArticles();
    const { analyzeArticle, isSubmitting } = useNewsMutations();
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analysisResults, setAnalysisResults] = useState<Map<string, NewsArticle['sentiment']>>(new Map());

    const handleAnalyze = async (article: NewsArticle) => {
        setAnalyzingId(article.id);
        try {
            const result = await analyzeArticle(article.id);
            if (result) {
                setAnalysisResults(new Map(analysisResults.set(article.id, result)));
            }
        } catch (error) {
            console.error('Analysis failed:', error);
        } finally {
            setAnalyzingId(null);
        }
    };

    const getAnalysis = (article: NewsArticle) => {
        return analysisResults.get(article.id) || article.sentiment;
    };

    const analyzedCount = articles.filter(a => a.sentiment || analysisResults.has(a.id)).length;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">AI 新聞分析</h1>
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
                        <Sparkles className="h-6 w-6 text-purple-500" />
                        AI 新聞分析
                    </h1>
                    <p className="text-muted-foreground">
                        Gemini 驅動的新聞情緒與影響力分析
                    </p>
                </div>
                <Button onClick={() => refresh()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新整理
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{articles.length}</div>
                        <div className="text-sm text-muted-foreground">總新聞數</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-green-600">
                            {articles.filter(a => getAnalysis(a)?.sentiment === 'bullish').length}
                        </div>
                        <div className="text-sm text-muted-foreground">看漲新聞</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-red-600">
                            {articles.filter(a => getAnalysis(a)?.sentiment === 'bearish').length}
                        </div>
                        <div className="text-sm text-muted-foreground">看跌新聞</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-purple-600">{analyzedCount}</div>
                        <div className="text-sm text-muted-foreground">已分析</div>
                    </CardContent>
                </Card>
            </div>

            {/* Disclaimer */}
            <div className="p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                    AI 分析結果僅供參考，不構成投資建議。分析準確度受新聞內容和市場情況影響。
                </span>
            </div>

            {/* Articles */}
            <div className="space-y-4">
                {articles.slice(0, 15).map((article) => {
                    const analysis = getAnalysis(article);
                    const isAnalyzing = analyzingId === article.id;

                    return (
                        <Card key={article.id} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex gap-4">
                                    {/* Sentiment indicator */}
                                    <div className={`w-1 rounded-full ${analysis?.sentiment === 'bullish' ? 'bg-green-500' :
                                            analysis?.sentiment === 'bearish' ? 'bg-red-500' :
                                                analysis?.sentiment === 'mixed' ? 'bg-yellow-500' : 'bg-gray-300'
                                        }`} />

                                    {/* Content */}
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <h3 className="font-medium mb-1">{article.title}</h3>
                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                    {article.summary}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 flex-shrink-0">
                                                {!analysis && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleAnalyze(article)}
                                                        disabled={isAnalyzing}
                                                    >
                                                        {isAnalyzing ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Brain className="h-4 w-4 mr-1" />
                                                                分析
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                                <a
                                                    href={article.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="查看原文"
                                                >
                                                    <Button size="sm" variant="ghost">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                </a>
                                            </div>
                                        </div>

                                        {/* Analysis Result */}
                                        {analysis && (
                                            <div className={`mt-3 p-3 rounded-lg ${sentimentConfig[analysis.sentiment]?.bgColor || ''}`}>
                                                <div className="flex items-center gap-4 mb-2">
                                                    <Badge className={sentimentConfig[analysis.sentiment]?.color}>
                                                        {analysis.sentiment === 'bullish' && <TrendingUp className="h-3 w-3 mr-1" />}
                                                        {analysis.sentiment === 'bearish' && <TrendingDown className="h-3 w-3 mr-1" />}
                                                        {analysis.sentiment === 'neutral' && <Minus className="h-3 w-3 mr-1" />}
                                                        {sentimentConfig[analysis.sentiment]?.label}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        信心度 {(analysis.confidence * 100).toFixed(0)}%
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        分數 {(analysis.sentimentScore * 100).toFixed(0)}
                                                    </span>
                                                </div>

                                                {analysis.keyPoints && analysis.keyPoints.length > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="text-xs font-medium">關鍵要點:</div>
                                                        <ul className="text-xs text-muted-foreground space-y-1">
                                                            {analysis.keyPoints.slice(0, 3).map((point, idx) => (
                                                                <li key={idx} className="flex items-start gap-1">
                                                                    <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                                                                    {point}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {analysis.entities && analysis.entities.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {analysis.entities.slice(0, 5).map((e, idx) => (
                                                            <Badge key={idx} variant="outline" className="text-xs">
                                                                {e.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Meta */}
                                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                                            <span>{article.sourceName}</span>
                                            {article.symbols?.slice(0, 3).map(s => (
                                                <Badge key={s} variant="secondary" className="text-xs">
                                                    {s}
                                                </Badge>
                                            ))}
                                            {article.severity && article.severity > 60 && (
                                                <SeverityBadge severity={article.severity} size="sm" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
