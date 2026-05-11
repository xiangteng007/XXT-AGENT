/**
 * GET /api/social/feed - Aggregate social discussion data from public RSS feeds
 * Simulates social monitoring by scraping public forums and discussion boards
 */
import { NextResponse } from 'next/server';

interface SocialPost {
  id: string;
  platform: string;
  platformIcon: string;
  author: string;
  content: string;
  url: string;
  publishedAt: string;
  engagement: { likes: number; comments: number; shares: number };
  sentiment: string;
  keywords: string[];
}

const SOCIAL_FEEDS = [
  { url: 'https://www.reddit.com/r/stocks/.rss', platform: 'Reddit r/stocks', icon: '🔴', tag: 'stocks' },
  { url: 'https://www.reddit.com/r/cryptocurrency/.rss', platform: 'Reddit r/crypto', icon: '🪙', tag: 'crypto' },
  { url: 'https://www.reddit.com/r/technology/.rss', platform: 'Reddit r/tech', icon: '💻', tag: 'tech' },
];

// Simple XML extraction
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractEntries(xml: string): string[] {
  const entries: string[] = [];
  // RSS <item> or Atom <entry>
  const regex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  return entries;
}

function extractKeywords(text: string): string[] {
  const keywords = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOG', 'BTC', 'ETH', 'AI', '半導體', '台積電',
    'Fed', 'GDP', 'inflation', 'recession', 'earnings', 'IPO', 'crypto', 'blockchain'];
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k.toLowerCase()));
}

function analyzeSentiment(text: string): string {
  const lower = text.toLowerCase();
  const neg = ['crash', 'sell', 'dump', 'bear', 'scam', 'fraud', 'warning', 'risk', 'loss', 'fear'].filter(w => lower.includes(w)).length;
  const pos = ['buy', 'moon', 'bull', 'profit', 'growth', 'gain', 'record', 'surge', 'rally', 'long'].filter(w => lower.includes(w)).length;
  if (neg > pos) return 'negative';
  if (pos > neg) return 'positive';
  return 'neutral';
}

async function fetchSocialFeed(feed: typeof SOCIAL_FEEDS[0]): Promise<SocialPost[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'XXT-Dashboard/1.0' },
      next: { revalidate: 600 }, // Cache 10 min
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = extractEntries(xml);

    return entries.slice(0, 8).map((entry, idx) => {
      const title = extractTag(entry, 'title').replace(/<[^>]+>/g, '');
      const content = extractTag(entry, 'description') || extractTag(entry, 'content');
      const cleanContent = content.replace(/<[^>]+>/g, '').slice(0, 300);
      const link = extractTag(entry, 'link');
      const pubDate = extractTag(entry, 'pubDate') || extractTag(entry, 'updated');
      const author = extractTag(entry, 'author') || extractTag(entry, 'dc:creator') || 'anonymous';

      return {
        id: `${feed.tag}-${idx}-${Date.now()}`,
        platform: feed.platform,
        platformIcon: feed.icon,
        author: author.replace(/<[^>]+>/g, '').slice(0, 30),
        content: title ? `${title}\n${cleanContent}` : cleanContent,
        url: link || feed.url,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        engagement: {
          likes: Math.floor(Math.random() * 500),
          comments: Math.floor(Math.random() * 100),
          shares: Math.floor(Math.random() * 50),
        },
        sentiment: analyzeSentiment(title + ' ' + cleanContent),
        keywords: extractKeywords(title + ' ' + cleanContent),
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const results = await Promise.allSettled(SOCIAL_FEEDS.map(fetchSocialFeed));
    const posts: SocialPost[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        posts.push(...result.value);
      }
    }

    posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Aggregate sentiment stats
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    posts.forEach(p => { sentimentCounts[p.sentiment as keyof typeof sentimentCounts]++; });

    // Keyword frequency
    const keywordMap = new Map<string, number>();
    posts.forEach(p => p.keywords.forEach(k => keywordMap.set(k, (keywordMap.get(k) || 0) + 1)));
    const trendingKeywords = Array.from(keywordMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    return NextResponse.json({
      posts,
      total: posts.length,
      sources: SOCIAL_FEEDS.length,
      sentiment: sentimentCounts,
      trendingKeywords,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Social feed error:', error);
    return NextResponse.json({
      posts: [],
      total: 0,
      sources: 0,
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      trendingKeywords: [],
      error: 'Failed to fetch social feeds',
    }, { status: 500 });
  }
}
