// AI-powered sentiment analysis for social posts

import { generateJSON } from '@/lib/ai/gemini-client';
import type {
    SocialPost,
    SentimentAnalysis,
    SentimentLabel,
    ExtractedEntity
} from './types';

/**
 * Analyze sentiment for a single post
 */
export async function analyzeSentiment(
    content: string,
    context?: { platform?: string; author?: string }
): Promise<SentimentAnalysis> {
    const prompt = `
分析以下社群貼文的情緒和內容：

貼文內容：
"${content}"

${context?.platform ? `平台：${context.platform}` : ''}
${context?.author ? `作者：${context.author}` : ''}

請以 JSON 格式回應：
- score: -1.0 到 1.0 的情緒分數 (負數=負面, 0=中性, 正數=正面)
- label: "positive" | "negative" | "neutral" | "mixed"
- confidence: 0 到 1 的信心度
- entities: 提及的實體陣列 [{ text, type: "person"|"organization"|"product"|"location"|"event"|"hashtag" }]
- topics: 相關主題字串陣列
- emotionBreakdown: { joy, anger, fear, sadness, surprise } 各 0-1 的分數
`;

    const result = await generateJSON<Omit<SentimentAnalysis, 'model' | 'analyzedAt'>>(prompt);

    return {
        ...result,
        model: 'gemini-1.5-flash',
        analyzedAt: new Date().toISOString(),
    };
}

/**
 * Batch analyze multiple posts
 */
export async function analyzeSentimentBatch(
    posts: Array<{ id: string; content: string }>
): Promise<Map<string, SentimentAnalysis>> {
    const results = new Map<string, SentimentAnalysis>();

    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < posts.length; i += batchSize) {
        const batch = posts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (post) => {
                try {
                    const analysis = await analyzeSentiment(post.content);
                    return { id: post.id, analysis };
                } catch (error) {
                    console.error(`Failed to analyze post ${post.id}:`, error);
                    return { id: post.id, analysis: createDefaultSentiment() };
                }
            })
        );

        batchResults.forEach(({ id, analysis }) => {
            results.set(id, analysis);
        });
    }

    return results;
}

/**
 * Quick sentiment classification (faster, less detailed)
 */
export async function classifySentiment(
    content: string
): Promise<{ label: SentimentLabel; score: number }> {
    const prompt = `
快速分類此貼文的情緒（只需回傳 JSON）：
"${content}"

格式：{ "label": "positive"|"negative"|"neutral"|"mixed", "score": -1到1的數字 }
`;

    return generateJSON<{ label: SentimentLabel; score: number }>(prompt);
}

/**
 * Analyze sentiment trends over time
 */
export async function analyzeTrend(
    posts: SocialPost[],
    groupBy: 'hour' | 'day' = 'day'
): Promise<{ period: string; avgScore: number; count: number; dominant: SentimentLabel }[]> {
    const groups = new Map<string, { scores: number[]; labels: SentimentLabel[] }>();

    posts.forEach(post => {
        if (!post.sentiment) return;

        const date = new Date(post.publishedAt);
        const key = groupBy === 'hour'
            ? `${date.toISOString().split('T')[0]} ${date.getHours()}:00`
            : date.toISOString().split('T')[0];

        if (!groups.has(key)) {
            groups.set(key, { scores: [], labels: [] });
        }

        const group = groups.get(key)!;
        group.scores.push(post.sentiment.score);
        group.labels.push(post.sentiment.label);
    });

    const results: { period: string; avgScore: number; count: number; dominant: SentimentLabel }[] = [];

    groups.forEach((data, period) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const labelCounts = data.labels.reduce((acc, label) => {
            acc[label] = (acc[label] || 0) + 1;
            return acc;
        }, {} as Record<SentimentLabel, number>);

        const dominant = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0][0] as SentimentLabel;

        results.push({
            period,
            avgScore,
            count: data.scores.length,
            dominant,
        });
    });

    return results.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Extract key topics from posts
 */
export async function extractTopics(
    posts: SocialPost[],
    maxTopics: number = 10
): Promise<{ topic: string; count: number; sentiment: SentimentLabel }[]> {
    const allContent = posts.slice(0, 50).map(p => p.content).join('\n---\n');

    const prompt = `
從以下社群貼文中提取主要討論主題：

${allContent}

請回傳 JSON 陣列，最多 ${maxTopics} 個主題：
[{ "topic": "主題名稱", "count": 出現次數估計, "sentiment": "positive"|"negative"|"neutral" }]
`;

    return generateJSON<{ topic: string; count: number; sentiment: SentimentLabel }[]>(prompt);
}

/**
 * Create default sentiment for fallback
 */
function createDefaultSentiment(): SentimentAnalysis {
    return {
        score: 0,
        label: 'neutral',
        confidence: 0,
        entities: [],
        topics: [],
        model: 'fallback',
        analyzedAt: new Date().toISOString(),
    };
}

/**
 * Get sentiment summary for dashboard
 */
export function calculateSentimentSummary(
    posts: SocialPost[]
): {
    overall: SentimentLabel;
    score: number;
    distribution: Record<SentimentLabel, number>;
    confidence: number;
} {
    const analyzed = posts.filter(p => p.sentiment);
    if (analyzed.length === 0) {
        return {
            overall: 'neutral',
            score: 0,
            distribution: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
            confidence: 0,
        };
    }

    const scores = analyzed.map(p => p.sentiment!.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgConfidence = analyzed.reduce((a, p) => a + p.sentiment!.confidence, 0) / analyzed.length;

    const distribution: Record<SentimentLabel, number> = {
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
    };

    analyzed.forEach(p => {
        distribution[p.sentiment!.label]++;
    });

    // Determine overall sentiment
    let overall: SentimentLabel;
    if (avgScore > 0.3) overall = 'positive';
    else if (avgScore < -0.3) overall = 'negative';
    else if (distribution.mixed > analyzed.length * 0.3) overall = 'mixed';
    else overall = 'neutral';

    return { overall, score: avgScore, distribution, confidence: avgConfidence };
}
