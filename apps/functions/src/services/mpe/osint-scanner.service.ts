/**
 * OSINT Scanner Service — 財經輿情掃描 + 情緒評分
 *
 * 掃描來源：
 *   - MoneyDJ RSS
 *   - 鉅亨網 RSS
 *   - Reuters Asia RSS
 *   - PTT Stock 版（HTML 解析）
 *
 * 每則新聞由 Ollama (qwen3:14b) 評分：
 *   -100 (極度負面) → +100 (極度正面)
 *
 * 輸出：加權平均情緒分數 + 關鍵事件標記
 */

import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import { ollamaGenerate, isOllamaAvailable } from '../local-inference.service';

const db = getFirestore();

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: number;     // -100 to +100
  tags?: string[];
  isKeyEvent?: boolean;   // 重大事件旗標
}

export interface SentimentReport {
  timestamp: Date;
  symbol?: string;        // 若指定標的則為個股情緒，否則為大盤
  overallScore: number;   // -100 to +100 加權平均
  rawScore: number;
  newsCount: number;
  keyEvents: string[];    // 重大事件列表
  topPositive: string;    // 最正面新聞標題
  topNegative: string;    // 最負面新聞標題
  breakdown: string;      // Ollama 文字解析
}

// ─────────────────────────────────────────
// RSS Feed Sources
// ─────────────────────────────────────────

const RSS_SOURCES = [
  {
    name: 'MoneyDJ',
    url: 'https://www.moneydj.com/DJIHMX/rss/News.djxml',
    weight: 1.0,
  },
  {
    name: '鉅亨網',
    url: 'https://news.cnyes.com/rss/tw/hot',
    weight: 0.9,
  },
  {
    name: 'Reuters Asia',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    weight: 1.2,
  },
  {
    name: '工商時報',
    url: 'https://ctee.com.tw/feed',
    weight: 0.8,
  },
];

// ─────────────────────────────────────────
// RSS Parser（手動，避免外部依賴）
// ─────────────────────────────────────────

function parseRssXml(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];

  try {
    // 簡易 regex RSS 解析（不依賴 xml2js）
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

    for (const block of itemMatches.slice(0, 10)) {
      const title   = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] ?? '';
      const desc    = block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/)?.[1] ?? '';
      const link    = block.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';

      if (!title) continue;

      items.push({
        title: title.replace(/<[^>]+>/g, '').trim(),
        summary: desc.replace(/<[^>]+>/g, '').trim().slice(0, 200),
        url: link.trim(),
        source: sourceName,
        publishedAt: pubDate ? new Date(pubDate) : new Date(),
      });
    }
  } catch (err) {
    logger.warn(`[OSINT] RSS parse error for ${sourceName}:`, err instanceof Error ? err.message : err);
  }

  return items;
}

// ─────────────────────────────────────────
// Fetch RSS
// ─────────────────────────────────────────

async function fetchRssFeed(source: typeof RSS_SOURCES[0]): Promise<NewsItem[]> {
  try {
    const resp = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 XXT-Agent/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return [];
    const xml = await resp.text();
    return parseRssXml(xml, source.name);
  } catch (err) {
    logger.warn(`[OSINT] Feed fetch failed ${source.name}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─────────────────────────────────────────
// Ollama Sentiment Scoring
// ─────────────────────────────────────────

const SENTIMENT_SYSTEM = `你是金融新聞情緒分析師。評估以下新聞標題對台股/美股市場的情緒影響。

輸出 JSON（單一物件）：
{"score": -100到+100, "tags": ["標籤1","標籤2"], "isKeyEvent": true或false, "reason": "一句話理由"}

score 說明：
  +100 = 極度正面（重大政策利多、超預期財報）
  +50  = 正面（企業獲利成長、市場回穩）
  0    = 中性（一般資訊、無明顯影響）
  -50  = 負面（通膨上升、地緣緊張）
  -100 = 極度負面（崩盤、黑天鵝、戰爭）

isKeyEvent = true 只在影響程度 >= |70| 時才設

只輸出 JSON，不要其他文字。`;

async function scoreSentimentBatch(news: NewsItem[]): Promise<NewsItem[]> {
  if (!await isOllamaAvailable() || news.length === 0) return news;

  // Batch up to 5 titles at once for efficiency
  const batches: NewsItem[][] = [];
  for (let i = 0; i < news.length; i += 5) {
    batches.push(news.slice(i, i + 5));
  }

  const scored: NewsItem[] = [];

  for (const batch of batches) {
    try {
      const input = batch.map((n, i) => `${i + 1}. ${n.title}`).join('\n');
      const rawPrompt = `請分別分析以下 ${batch.length} 則新聞，輸出 JSON 陣列（每則一個物件）：\n${input}`;

      const raw = await ollamaGenerate(rawPrompt, SENTIMENT_SYSTEM, 'qwen3:14b', {
        temperature: 0.1,
        num_predict: 512,
      });

      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      let results: Array<{ score: number; tags: string[]; isKeyEvent: boolean; reason: string }>;

      try {
        const parsed = JSON.parse(cleaned);
        results = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fallback: neutral score
        results = batch.map(() => ({ score: 0, tags: [], isKeyEvent: false, reason: 'parse error' }));
      }

      batch.forEach((item, i) => {
        const r = results[i] ?? { score: 0, tags: [], isKeyEvent: false };
        scored.push({
          ...item,
          sentiment: Math.max(-100, Math.min(100, r.score ?? 0)),
          tags: r.tags ?? [],
          isKeyEvent: r.isKeyEvent ?? false,
        });
      });
    } catch {
      batch.forEach(item => scored.push({ ...item, sentiment: 0 }));
    }
  }

  return scored;
}

// ─────────────────────────────────────────
// Keyword filter for symbol-specific news
// ─────────────────────────────────────────

function filterBySymbol(news: NewsItem[], symbol: string): NewsItem[] {
  // Simple keyword match: stock code or company name
  const lower = symbol.toLowerCase();
  return news.filter(n =>
    n.title.toLowerCase().includes(lower) ||
    n.summary.toLowerCase().includes(lower)
  );
}

// ─────────────────────────────────────────
// Main OSINT scan
// ─────────────────────────────────────────

export async function runOsintScan(symbol?: string): Promise<SentimentReport> {
  logger.info(`[OSINT] Starting scan${symbol ? ` for ${symbol}` : ' (market-wide)'}`);

  // Fetch all RSS feeds in parallel
  const allNewsArrays = await Promise.all(RSS_SOURCES.map(fetchRssFeed));
  let allNews = allNewsArrays.flat();

  // Filter to last 6 hours
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  allNews = allNews.filter(n => n.publishedAt.getTime() > sixHoursAgo);

  // Symbol-specific filter
  if (symbol) {
    const filtered = filterBySymbol(allNews, symbol);
    if (filtered.length > 0) allNews = filtered;
    // If no symbol-specific news found, keep all for general context
  }

  // Score sentiment with Ollama (top 20 most recent)
  const toScore = allNews.slice(0, 20);
  const scored = await scoreSentimentBatch(toScore);

  // Weighted average sentiment
  const sourceWeightMap = Object.fromEntries(RSS_SOURCES.map(s => [s.name, s.weight]));
  let totalWeight = 0;
  let weightedSum = 0;
  const keyEvents: string[] = [];

  for (const item of scored) {
    const score = item.sentiment ?? 0;
    const weight = sourceWeightMap[item.source] ?? 1.0;
    totalWeight += weight;
    weightedSum += score * weight;
    if (item.isKeyEvent) keyEvents.push(item.title);
  }

  const rawScore = scored.length > 0 ? weightedSum / totalWeight : 0;

  // Clamp and round
  const overallScore = Math.round(Math.max(-100, Math.min(100, rawScore)));

  // Top positive/negative
  const sortedByScore = [...scored].sort((a, b) => (b.sentiment ?? 0) - (a.sentiment ?? 0));
  const topPositive = sortedByScore[0]?.title ?? '無正面新聞';
  const topNegative = sortedByScore[sortedByScore.length - 1]?.title ?? '無負面新聞';

  // Ollama synthesis
  let breakdown = '情緒評估服務離線';
  if (await isOllamaAvailable() && scored.length > 0) {
    try {
      const newsDigest = scored.slice(0, 5).map(n => `- ${n.title}（${n.sentiment ?? 0}分）`).join('\n');
      breakdown = await ollamaGenerate(
        `以下是最近財經新聞（情緒評分）：\n${newsDigest}\n\n用一段100字以內的繁體中文總結目前市場情緒。`,
        '你是市場分析師，用簡潔的語言總結情緒。',
        'qwen3:14b',
        { temperature: 0.4, num_predict: 200 },
      );
    } catch {
      breakdown = `市場情緒分數 ${overallScore > 0 ? '+' : ''}${overallScore}，共掃描 ${scored.length} 則新聞。`;
    }
  }

  const report: SentimentReport = {
    timestamp: new Date(),
    symbol,
    overallScore,
    rawScore: Math.round(rawScore * 10) / 10,
    newsCount: scored.length,
    keyEvents,
    topPositive,
    topNegative,
    breakdown: breakdown.trim(),
  };

  // Persist to Firestore
  await db.collection('mpe_sentiment_history').add({
    ...report,
    timestamp: Timestamp.fromDate(report.timestamp),
  });

  logger.info(`[OSINT] Scan complete: score=${overallScore}, news=${scored.length}, keyEvents=${keyEvents.length}`);
  return report;
}

// ─────────────────────────────────────────
// Prompt Formatter
// ─────────────────────────────────────────

export function formatSentimentForPrompt(report: SentimentReport): string {
  const level =
    report.overallScore >= 60  ? '🟢 極度樂觀' :
    report.overallScore >= 20  ? '🟡 偏樂觀' :
    report.overallScore >= -20 ? '⚪ 中性' :
    report.overallScore >= -60 ? '🟠 偏悲觀' :
                                  '🔴 極度悲觀';

  const lines = [
    `【輿情情緒 ${report.timestamp.toLocaleTimeString('zh-TW')}】`,
    `綜合情緒：${level}（${report.overallScore > 0 ? '+' : ''}${report.overallScore}分）`,
    `掃描新聞：${report.newsCount} 則`,
  ];

  if (report.keyEvents.length > 0) {
    lines.push(`⚠️ 重大事件：${report.keyEvents.slice(0, 2).join('；')}`);
  }

  lines.push(`解析：${report.breakdown}`);
  return lines.join('\n');
}
