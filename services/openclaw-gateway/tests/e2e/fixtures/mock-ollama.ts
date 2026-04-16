/**
 * mock-ollama.ts — D-1: Ollama 推理引擎 Mock
 *
 * 提供 vi.mock 用的模擬函數，讓 E2E 測試不依賴真實 Ollama 服務。
 * 模擬兩種回應模式：
 *   1. Intent Router — 回傳 JSON 格式的 agent 路由決策
 *   2. Agent Chat — 回傳自然語言回覆
 *
 * 使用方式：
 *   在 E2E test 中 vi.mock 相關模組，或在 fetch 層攔截 Ollama 端點。
 */

/**
 * 模擬的 Ollama /api/chat 回應。
 * 符合 OpenAI-compatible chat completion 格式。
 */
export function createOllamaChatResponse(content: string) {
  return {
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    model: 'qwen3:14b',
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

/**
 * Intent Router 標準回應：將訊息路由到 director agent。
 */
export function createIntentRouterResponse(agentId = 'director') {
  return createOllamaChatResponse(
    JSON.stringify({
      agent_id: agentId,
      reply_message: '收到，我來處理。',
      task_symbol: null,
    }),
  );
}

/**
 * 建立一個 mock fetch 函數，攔截 Ollama 和 AI Gateway 呼叫。
 *
 * @param originalFetch - 原始 fetch 函數（用於 non-Ollama 請求）
 * @param mockResponse - 自訂 mock 回應（預設為 intent router）
 */
export function createMockFetch(
  originalFetch: typeof globalThis.fetch,
  mockResponse?: Record<string, unknown>,
) {
  const defaultResponse = mockResponse ?? createIntentRouterResponse();

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // 攔截 Ollama 呼叫
    if (url.includes('mock-ollama') || url.includes(':11434')) {
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 攔截 AI Gateway 呼叫
    if (url.includes(':8080') && init?.method === 'POST') {
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 攔截 Investment Brain 呼叫
    if (url.includes(':8090')) {
      return new Response('data: {"node":"complete","status":"done"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    // 其他請求透傳
    return originalFetch(input, init);
  };
}
