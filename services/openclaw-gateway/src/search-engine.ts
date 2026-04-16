import { logger } from './logger';
import { PrivacyRouter } from './privacy-router';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

/**
 * 使用 Tavily / Firecrawl 或 Custom API 進行網頁搜尋
 * 這裡實作一個相容介面，背後可串接您偏好的 Search API
 */
export async function searchWeb(query: string): Promise<string> {
  const classification = PrivacyRouter.classify(query);
  if (classification.level === 'PRIVATE') {
    logger.warn(`[SearchEngine] BLOCKED search query containing sensitive data: [${classification.detectedKeywords.join(', ')}]`);
    return `[系統警告]：您的搜尋關鍵字包含高度機密資料（如：${classification.detectedKeywords[0]}），為避免資料外洩，OpenClaw 安全路由器已阻擋本次連網行動。請重新構思沒有機敏數字的網頁搜尋關鍵字。`;
  }

  logger.info(`[SearchEngine] Executing web search query: "${query}"`);
  
  const TAVILY_API_KEY = process.env['TAVILY_API_KEY'];
  
  // 若沒有 API Key，則回傳安全預設值 (避免 Gateway 崩潰)
  if (!TAVILY_API_KEY) {
    logger.warn('[SearchEngine] TAVILY_API_KEY not found. Returning mock search data.');
    return `[Mock Web Search Data] 關於 "${query}" 的最新搜尋結果：目前系統尚未設定真實 TAVILY_API_KEY。`;
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_answers: true,
        max_results: 3
      }),
      signal: AbortSignal.timeout(8000), // 8 秒超時
    });

    if (!res.ok) {
      throw new Error(`Search API error: ${res.statusText}`);
    }

    const data = await res.json() as { 
      answer?: string, 
      results?: SearchResult[] 
    };

    let finalStr = '';
    if (data.answer) {
      finalStr += `【AI 摘要】：${data.answer}\n\n`;
    }

    if (data.results && data.results.length > 0) {
      data.results.forEach((r, i) => {
        finalStr += `[Result ${i+1}] ${r.title}\nURL: ${r.url}\n${r.content}\n\n`;
      });
    }

    return finalStr || '未找到相關結果。';

  } catch (error) {
    logger.error(`[SearchEngine] Search failed: ${error}`);
    return `網頁搜尋失敗，請基於既有知識回答。錯誤：${error}`;
  }
}
