'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface NewsWidgetProps {
  symbol?: string;
  className?: string;
}

export function NewsWidget({ symbol = '', className = '' }: NewsWidgetProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const openclawUrl = process.env.NEXT_PUBLIC_OPENCLAW_URL || 'http://localhost:3100';
        const response = await fetch(`${openclawUrl}/invest/news?symbol=${encodeURIComponent(symbol)}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }
        
        const data = await response.json();
        if (isMounted) {
          setNews(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching news:', err);
        if (isMounted) {
          setError('無法載入新聞資訊');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNews();

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'negative':
        return <TrendingDown className="w-3 h-3 text-red-500" />;
      default:
        return <Minus className="w-3 h-3 text-gray-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'border-green-500/20 bg-green-500/10 text-green-500';
      case 'negative':
        return 'border-red-500/20 bg-red-500/10 text-red-500';
      default:
        return 'border-gray-500/20 bg-gray-500/10 text-gray-500';
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Card className={`border-[#3d3d3d] bg-[#121212]/80 backdrop-blur-md ${className}`}>
      <CardHeader className="py-3 px-4 border-b border-[#3d3d3d]/50">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-[#D97706]">
          <Newspaper className="w-4 h-4" />
          市場即時新聞 {symbol ? `- ${symbol}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#9ca3af]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">載入情報中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-red-400">
            <span className="text-sm">{error}</span>
          </div>
        ) : news.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#9ca3af]">
            <span className="text-sm">目前無相關新聞</span>
          </div>
        ) : (
          <ScrollArea className="h-[300px] w-full">
            <div className="flex flex-col divide-y divide-[#3d3d3d]/30">
              {news.map((item) => (
                <div key={item.id} className="p-4 hover:bg-[#1a1a1a] transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-[#9ca3af]">{item.source} • {formatDate(item.timestamp)}</span>
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 flex items-center gap-1 ${getSentimentColor(item.sentiment)}`}>
                      {getSentimentIcon(item.sentiment)}
                      {item.sentiment === 'positive' ? '看多' : item.sentiment === 'negative' ? '看空' : '中立'}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-medium text-[#f5f5f5] mb-1 leading-snug">{item.title}</h4>
                  <p className="text-xs text-[#9ca3af] line-clamp-2 leading-relaxed">{item.summary}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
