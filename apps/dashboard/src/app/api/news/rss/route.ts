/**
 * GET /api/news/rss - Aggregate financial news from free RSS feeds
 * Returns parsed articles from multiple sources
 */
import { NextResponse } from 'next/server';

interface RSSArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceIcon: string;
  url: string;
  publishedAt: string;
  category: string;
  sentiment: string;
  severity: number;
}

const RSS_FEEDS = [
  { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,MSFT,NVDA,TSLA,GOOG&region=US&lang=en-US', source: 'Yahoo Finance', icon: '🔮', category: 'stocks' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC', icon: '📺', category: 'general' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business', icon: '📰', category: 'general' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', source: 'NYT Business', icon: '📊', category: 'general' },
];

// Simple XML tag extraction (no external deps)
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractItems(xml: string): string[] {
  const items: string[] = [];
  const regex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

// Simple keyword-based sentiment
function analyzeSentiment(text: string): { label: string; severity: number } {
  const lower = text.toLowerCase();
  const negative = ['crash', 'fall', 'drop', 'decline', 'loss', 'risk', 'warning', 'crisis', 'fear', 'recession', 'bearish', 'sell', '下跌', '崩盤', '風險', '警告'];
  const positive = ['surge', 'rise', 'gain', 'rally', 'growth', 'record', 'bullish', 'buy', 'profit', 'boom', '上漲', '漲幅', '利多', '突破'];

  const negScore = negative.filter(w => lower.includes(w)).length;
  const posScore = positive.filter(w => lower.includes(w)).length;

  if (negScore > posScore) return { label: 'negative', severity: Math.min(90, 50 + negScore * 15) };
  if (posScore > negScore) return { label: 'positive', severity: Math.min(70, 30 + posScore * 10) };
  return { label: 'neutral', severity: 30 };
}

async function fetchFeed(feed: typeof RSS_FEEDS[0]): Promise<RSSArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'XXT-Dashboard/1.0' },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const xml = await res.text();
    const items = extractItems(xml);

    return items.slice(0, 10).map((item, idx) => {
      const title = extractTag(item, 'title');
      const description = extractTag(item, 'description');
      const link = extractTag(item, 'link');
      const pubDate = extractTag(item, 'pubDate');
      const { label, severity } = analyzeSentiment(title + ' ' + description);

      return {
        id: `${feed.source.replace(/\s/g, '-')}-${idx}-${Date.now()}`,
        title: title.replace(/<[^>]+>/g, ''),
        summary: description.replace(/<[^>]+>/g, '').slice(0, 200),
        source: feed.source,
        sourceIcon: feed.icon,
        url: link || feed.url,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        category: feed.category,
        sentiment: label,
        severity,
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
    const articles: RSSArticle[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        articles.push(...result.value);
      }
    }

    // Sort by date descending
    articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return NextResponse.json({
      articles,
      total: articles.length,
      sources: RSS_FEEDS.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('RSS fetch error:', error);
    return NextResponse.json({
      articles: [],
      total: 0,
      sources: 0,
      error: 'Failed to fetch news feeds',
    }, { status: 500 });
  }
}
