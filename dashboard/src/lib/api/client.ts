import { getSettings } from '@/lib/store/settings';
import { ENDPOINTS } from './endpoints';
import type {
    FusedEvent,
    SocialPost,
    NewsItem,
    MarketQuote,
    SystemMetrics,
    Keyword,
    ExcludeWord,
    NotificationRule,
} from './types';

// Import mock data
import mockFusedEvents from '@/mocks/fused_events.json';
import mockSocialPosts from '@/mocks/social_posts.json';
import mockNewsItems from '@/mocks/news_items.json';
import mockMarketQuotes from '@/mocks/market_quotes.json';
import mockSystemMetrics from '@/mocks/system_metrics.json';
import mockKeywords from '@/mocks/keywords.json';
import mockExcludeWords from '@/mocks/exclude_words.json';
import mockNotifications from '@/mocks/notifications.json';

const DEFAULT_TIMEOUT = 10000; // 10 seconds

interface FetchOptions {
    timeout?: number;
}

class ApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

async function fetchWithTimeout(
    url: string,
    options: RequestInit & FetchOptions = {}
): Promise<Response> {
    const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function apiRequest<T>(
    endpoint: string,
    mockData: T,
    options: RequestInit & FetchOptions = {}
): Promise<T> {
    const settings = getSettings();

    // If in mock mode, return mock data directly
    if (settings.dataMode === 'mock') {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return mockData;
    }

    // Live mode: try to fetch from API
    const baseUrl = settings.apiBaseUrl || '';
    if (!baseUrl) {
        console.warn('Live mode enabled but no API base URL configured. Falling back to mock data.');
        return mockData;
    }

    try {
        const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options,
        });

        if (!response.ok) {
            throw new ApiError(
                `API request failed: ${response.statusText}`,
                response.status
            );
        }

        return await response.json();
    } catch (error) {
        // Fallback to mock data on any error
        console.warn(`API request failed, falling back to mock data:`, error);
        return mockData;
    }
}

// =============================================================================
// API Functions
// =============================================================================

export async function getFusedEvents(): Promise<FusedEvent[]> {
    return apiRequest<FusedEvent[]>(
        ENDPOINTS.FUSED_EVENTS,
        mockFusedEvents as FusedEvent[]
    );
}

export async function getSocialPosts(): Promise<SocialPost[]> {
    return apiRequest<SocialPost[]>(
        ENDPOINTS.SOCIAL_POSTS,
        mockSocialPosts as SocialPost[]
    );
}

export async function getNewsItems(): Promise<NewsItem[]> {
    return apiRequest<NewsItem[]>(
        ENDPOINTS.NEWS_ITEMS,
        mockNewsItems as NewsItem[]
    );
}

export async function getMarketQuotes(): Promise<MarketQuote[]> {
    return apiRequest<MarketQuote[]>(
        ENDPOINTS.MARKET_QUOTES,
        mockMarketQuotes as MarketQuote[]
    );
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
    return apiRequest<SystemMetrics>(
        ENDPOINTS.SYSTEM_METRICS,
        mockSystemMetrics as SystemMetrics
    );
}

export async function getKeywords(): Promise<Keyword[]> {
    return apiRequest<Keyword[]>(ENDPOINTS.KEYWORDS, mockKeywords as Keyword[]);
}

export async function getExcludeWords(): Promise<ExcludeWord[]> {
    return apiRequest<ExcludeWord[]>(
        ENDPOINTS.EXCLUDE_WORDS,
        mockExcludeWords as ExcludeWord[]
    );
}

export async function getNotifications(): Promise<NotificationRule[]> {
    return apiRequest<NotificationRule[]>(
        ENDPOINTS.NOTIFICATIONS,
        mockNotifications as NotificationRule[]
    );
}

// Re-export types
export * from './types';
export { ENDPOINTS } from './endpoints';
