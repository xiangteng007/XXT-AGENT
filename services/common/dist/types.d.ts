/**
 * FusedEvent Schema v2.0
 * Enhanced with explainable severity scores
 *
 * Per XXT-AGENT Production-Grade Upgrade Plan
 */
import { z } from 'zod';
export declare const InstrumentSchema: z.ZodObject<{
    type: z.ZodEnum<["stock", "future", "fund", "fx", "crypto", "etf"]>;
    symbol: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    exchange: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
    name?: string | undefined;
    exchange?: string | undefined;
}, {
    symbol: string;
    type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
    name?: string | undefined;
    exchange?: string | undefined;
}>;
export declare const EvidenceSchema: z.ZodObject<{
    source: z.ZodEnum<["market", "news", "social"]>;
    title: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    ts: z.ZodString;
    platform: z.ZodOptional<z.ZodString>;
    postId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: "market" | "social" | "news";
    title: string;
    ts: string;
    platform?: string | undefined;
    url?: string | undefined;
    postId?: string | undefined;
}, {
    source: "market" | "social" | "news";
    title: string;
    ts: string;
    platform?: string | undefined;
    url?: string | undefined;
    postId?: string | undefined;
}>;
export declare const ActionSchema: z.ZodObject<{
    type: z.ZodEnum<["watch", "buy", "sell", "hold", "alert"]>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "alert" | "watch" | "buy" | "sell" | "hold";
    reason: string;
}, {
    type: "alert" | "watch" | "buy" | "sell" | "hold";
    reason: string;
}>;
export declare const SeverityScoresSchema: z.ZodObject<{
    market: z.ZodNumber;
    news: z.ZodNumber;
    social: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    market: number;
    social: number;
    news: number;
}, {
    market: number;
    social: number;
    news: number;
}>;
export declare const SeverityBreakdownSchema: z.ZodObject<{
    scores: z.ZodObject<{
        market: z.ZodNumber;
        news: z.ZodNumber;
        social: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        market: number;
        social: number;
        news: number;
    }, {
        market: number;
        social: number;
        news: number;
    }>;
    confidence: z.ZodNumber;
    finalScore: z.ZodNumber;
    explain: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    scores: {
        market: number;
        social: number;
        news: number;
    };
    finalScore: number;
    explain?: string | undefined;
}, {
    confidence: number;
    scores: {
        market: number;
        social: number;
        news: number;
    };
    finalScore: number;
    explain?: string | undefined;
}>;
export declare const NewsSourceSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    publisher: z.ZodOptional<z.ZodString>;
    publishedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    url?: string | undefined;
    publisher?: string | undefined;
    publishedAt?: string | undefined;
}, {
    id: string;
    title: string;
    url?: string | undefined;
    publisher?: string | undefined;
    publishedAt?: string | undefined;
}>;
export declare const SocialSourceSchema: z.ZodObject<{
    platform: z.ZodString;
    author: z.ZodString;
    content: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    engagement: z.ZodOptional<z.ZodObject<{
        likes: z.ZodNumber;
        comments: z.ZodNumber;
        shares: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        likes: number;
        comments: number;
        shares: number;
    }, {
        likes: number;
        comments: number;
        shares: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    platform: string;
    content: string;
    author: string;
    url?: string | undefined;
    engagement?: {
        likes: number;
        comments: number;
        shares: number;
    } | undefined;
}, {
    platform: string;
    content: string;
    author: string;
    url?: string | undefined;
    engagement?: {
        likes: number;
        comments: number;
        shares: number;
    } | undefined;
}>;
export declare const MarketSourceSchema: z.ZodObject<{
    symbol: z.ZodString;
    change: z.ZodNumber;
    changePct: z.ZodNumber;
    volumeRatio: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    change: number;
    changePct: number;
    volumeRatio?: number | undefined;
}, {
    symbol: string;
    change: number;
    changePct: number;
    volumeRatio?: number | undefined;
}>;
export declare const FusedEventSchemaV2: z.ZodObject<{
    id: z.ZodString;
    ts: z.ZodString;
    title: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    severity: z.ZodNumber;
    severityBreakdown: z.ZodOptional<z.ZodObject<{
        scores: z.ZodObject<{
            market: z.ZodNumber;
            news: z.ZodNumber;
            social: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            market: number;
            social: number;
            news: number;
        }, {
            market: number;
            social: number;
            news: number;
        }>;
        confidence: z.ZodNumber;
        finalScore: z.ZodNumber;
        explain: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        scores: {
            market: number;
            social: number;
            news: number;
        };
        finalScore: number;
        explain?: string | undefined;
    }, {
        confidence: number;
        scores: {
            market: number;
            social: number;
            news: number;
        };
        finalScore: number;
        explain?: string | undefined;
    }>>;
    eventType: z.ZodEnum<["market", "news", "social", "fusion"]>;
    sentiment: z.ZodEnum<["bullish", "bearish", "neutral", "mixed", "unknown"]>;
    symbols: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    instrument: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["stock", "future", "fund", "fx", "crypto", "etf"]>;
        symbol: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        exchange: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
        name?: string | undefined;
        exchange?: string | undefined;
    }, {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
        name?: string | undefined;
        exchange?: string | undefined;
    }>>;
    sources: z.ZodOptional<z.ZodObject<{
        news: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            publisher: z.ZodOptional<z.ZodString>;
            publishedAt: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }, {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }>, "many">>;
        social: z.ZodOptional<z.ZodArray<z.ZodObject<{
            platform: z.ZodString;
            author: z.ZodString;
            content: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            engagement: z.ZodOptional<z.ZodObject<{
                likes: z.ZodNumber;
                comments: z.ZodNumber;
                shares: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                likes: number;
                comments: number;
                shares: number;
            }, {
                likes: number;
                comments: number;
                shares: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }, {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }>, "many">>;
        market: z.ZodOptional<z.ZodArray<z.ZodObject<{
            symbol: z.ZodString;
            change: z.ZodNumber;
            changePct: z.ZodNumber;
            volumeRatio: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }, {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        market?: {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }[] | undefined;
        social?: {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }[] | undefined;
        news?: {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }[] | undefined;
    }, {
        market?: {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }[] | undefined;
        social?: {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }[] | undefined;
        news?: {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }[] | undefined;
    }>>;
    evidence: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<["market", "news", "social"]>;
        title: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        ts: z.ZodString;
        platform: z.ZodOptional<z.ZodString>;
        postId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }, {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }>, "many">>;
    impactHypothesis: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    confidence: z.ZodNumber;
    actions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["watch", "buy", "sell", "hold", "alert"]>;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }, {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }>, "many">>;
    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    location: z.ZodOptional<z.ZodString>;
    processedAt: z.ZodOptional<z.ZodString>;
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    version: string;
    ts: string;
    eventType: "market" | "social" | "news" | "fusion";
    severity: number;
    sentiment: "unknown" | "bullish" | "bearish" | "neutral" | "mixed";
    confidence: number;
    symbols: string[];
    tags: string[];
    location?: string | undefined;
    summary?: string | undefined;
    instrument?: {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
        name?: string | undefined;
        exchange?: string | undefined;
    } | undefined;
    evidence?: {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }[] | undefined;
    severityBreakdown?: {
        confidence: number;
        scores: {
            market: number;
            social: number;
            news: number;
        };
        finalScore: number;
        explain?: string | undefined;
    } | undefined;
    sources?: {
        market?: {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }[] | undefined;
        social?: {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }[] | undefined;
        news?: {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }[] | undefined;
    } | undefined;
    impactHypothesis?: string[] | undefined;
    actions?: {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }[] | undefined;
    keywords?: string[] | undefined;
    processedAt?: string | undefined;
}, {
    id: string;
    title: string;
    ts: string;
    eventType: "market" | "social" | "news" | "fusion";
    severity: number;
    sentiment: "unknown" | "bullish" | "bearish" | "neutral" | "mixed";
    confidence: number;
    location?: string | undefined;
    summary?: string | undefined;
    version?: string | undefined;
    instrument?: {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
        name?: string | undefined;
        exchange?: string | undefined;
    } | undefined;
    evidence?: {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }[] | undefined;
    severityBreakdown?: {
        confidence: number;
        scores: {
            market: number;
            social: number;
            news: number;
        };
        finalScore: number;
        explain?: string | undefined;
    } | undefined;
    symbols?: string[] | undefined;
    tags?: string[] | undefined;
    sources?: {
        market?: {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }[] | undefined;
        social?: {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }[] | undefined;
        news?: {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }[] | undefined;
    } | undefined;
    impactHypothesis?: string[] | undefined;
    actions?: {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }[] | undefined;
    keywords?: string[] | undefined;
    processedAt?: string | undefined;
}>;
export declare const FusedEventSchema: z.ZodObject<{
    id: z.ZodString;
    ts: z.ZodString;
    title: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    severity: z.ZodNumber;
    severityBreakdown: z.ZodOptional<z.ZodObject<{
        scores: z.ZodObject<{
            market: z.ZodNumber;
            news: z.ZodNumber;
            social: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            market: number;
            social: number;
            news: number;
        }, {
            market: number;
            social: number;
            news: number;
        }>;
        confidence: z.ZodNumber;
        finalScore: z.ZodNumber;
        explain: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        scores: {
            market: number;
            social: number;
            news: number;
        };
        finalScore: number;
        explain?: string | undefined;
    }, {
        confidence: number;
        scores: {
            market: number;
            social: number;
            news: number;
        };
        finalScore: number;
        explain?: string | undefined;
    }>>;
    eventType: z.ZodEnum<["market", "news", "social", "fusion"]>;
    sentiment: z.ZodEnum<["bullish", "bearish", "neutral", "mixed", "unknown"]>;
    symbols: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    instrument: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["stock", "future", "fund", "fx", "crypto", "etf"]>;
        symbol: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        exchange: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
        name?: string | undefined;
        exchange?: string | undefined;
    }, {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
        name?: string | undefined;
        exchange?: string | undefined;
    }>>;
    sources: z.ZodOptional<z.ZodObject<{
        news: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            publisher: z.ZodOptional<z.ZodString>;
            publishedAt: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }, {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }>, "many">>;
        social: z.ZodOptional<z.ZodArray<z.ZodObject<{
            platform: z.ZodString;
            author: z.ZodString;
            content: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            engagement: z.ZodOptional<z.ZodObject<{
                likes: z.ZodNumber;
                comments: z.ZodNumber;
                shares: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                likes: number;
                comments: number;
                shares: number;
            }, {
                likes: number;
                comments: number;
                shares: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }, {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }>, "many">>;
        market: z.ZodOptional<z.ZodArray<z.ZodObject<{
            symbol: z.ZodString;
            change: z.ZodNumber;
            changePct: z.ZodNumber;
            volumeRatio: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }, {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        market?: {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }[] | undefined;
        social?: {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }[] | undefined;
        news?: {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }[] | undefined;
    }, {
        market?: {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }[] | undefined;
        social?: {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }[] | undefined;
        news?: {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }[] | undefined;
    }>>;
    evidence: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<["market", "news", "social"]>;
        title: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        ts: z.ZodString;
        platform: z.ZodOptional<z.ZodString>;
        postId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }, {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }>, "many">>;
    impactHypothesis: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    confidence: z.ZodNumber;
    actions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["watch", "buy", "sell", "hold", "alert"]>;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }, {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }>, "many">>;
    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    location: z.ZodOptional<z.ZodString>;
    processedAt: z.ZodOptional<z.ZodString>;
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    version: string;
    ts: string;
    eventType: "market" | "social" | "news" | "fusion";
    severity: number;
    sentiment: "unknown" | "bullish" | "bearish" | "neutral" | "mixed";
    confidence: number;
    symbols: string[];
    tags: string[];
    location?: string | undefined;
    summary?: string | undefined;
    instrument?: {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
        name?: string | undefined;
        exchange?: string | undefined;
    } | undefined;
    evidence?: {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }[] | undefined;
    severityBreakdown?: {
        confidence: number;
        scores: {
            market: number;
            social: number;
            news: number;
        };
        finalScore: number;
        explain?: string | undefined;
    } | undefined;
    sources?: {
        market?: {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }[] | undefined;
        social?: {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }[] | undefined;
        news?: {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }[] | undefined;
    } | undefined;
    impactHypothesis?: string[] | undefined;
    actions?: {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }[] | undefined;
    keywords?: string[] | undefined;
    processedAt?: string | undefined;
}, {
    id: string;
    title: string;
    ts: string;
    eventType: "market" | "social" | "news" | "fusion";
    severity: number;
    sentiment: "unknown" | "bullish" | "bearish" | "neutral" | "mixed";
    confidence: number;
    location?: string | undefined;
    summary?: string | undefined;
    version?: string | undefined;
    instrument?: {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx" | "etf";
        name?: string | undefined;
        exchange?: string | undefined;
    } | undefined;
    evidence?: {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }[] | undefined;
    severityBreakdown?: {
        confidence: number;
        scores: {
            market: number;
            social: number;
            news: number;
        };
        finalScore: number;
        explain?: string | undefined;
    } | undefined;
    symbols?: string[] | undefined;
    tags?: string[] | undefined;
    sources?: {
        market?: {
            symbol: string;
            change: number;
            changePct: number;
            volumeRatio?: number | undefined;
        }[] | undefined;
        social?: {
            platform: string;
            content: string;
            author: string;
            url?: string | undefined;
            engagement?: {
                likes: number;
                comments: number;
                shares: number;
            } | undefined;
        }[] | undefined;
        news?: {
            id: string;
            title: string;
            url?: string | undefined;
            publisher?: string | undefined;
            publishedAt?: string | undefined;
        }[] | undefined;
    } | undefined;
    impactHypothesis?: string[] | undefined;
    actions?: {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }[] | undefined;
    keywords?: string[] | undefined;
    processedAt?: string | undefined;
}>;
export type Instrument = z.infer<typeof InstrumentSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type SeverityScores = z.infer<typeof SeverityScoresSchema>;
export type SeverityBreakdown = z.infer<typeof SeverityBreakdownSchema>;
export type NewsSource = z.infer<typeof NewsSourceSchema>;
export type SocialSource = z.infer<typeof SocialSourceSchema>;
export type MarketSource = z.infer<typeof MarketSourceSchema>;
export type FusedEvent = z.infer<typeof FusedEventSchemaV2>;
export interface RawMarketEvent {
    id: string;
    ts: string;
    source: 'market';
    symbol: string;
    quote: {
        last_price: number | null;
        change_pct?: number;
        volume?: number;
        volumeRatio?: number;
    };
}
export interface RawNewsEvent {
    id: string;
    ts: string;
    source: 'news';
    title: string;
    url: string;
    publisher?: string;
    summary?: string;
    keywords?: string[];
    sentiment?: string;
}
export interface RawSocialEvent {
    id: string;
    ts: string;
    source: 'social';
    platform: string;
    postId: string;
    author: string;
    text: string;
    url?: string;
    engagement?: {
        likes: number;
        comments: number;
        shares: number;
    };
    sentiment?: string;
}
export type RawEvent = RawMarketEvent | RawNewsEvent | RawSocialEvent;
/**
 * Severity label mapping
 * 1-3: LOW - Noise/general volatility
 * 4-6: MEDIUM - Observable event
 * 7-8: HIGH - High risk/impact (push notification)
 * 9-10: CRITICAL - Force push + generate report
 */
export declare function getSeverityLabel(severity: number): string;
/**
 * Calculate final severity from component scores
 */
export declare function calculateSeverity(scores: SeverityScores, confidence: number): number;
/**
 * Create severity breakdown
 */
export declare function createSeverityBreakdown(scores: SeverityScores, confidence: number, explain?: string): SeverityBreakdown;
/**
 * Validate and parse FusedEvent
 */
export declare function parseFusedEvent(data: unknown): FusedEvent;
/**
 * Safe parse FusedEvent (returns null on error)
 */
export declare function safeParseFusedEvent(data: unknown): FusedEvent | null;
