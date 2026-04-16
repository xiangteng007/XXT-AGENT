/**
 * api-client.ts — D-1: E2E 測試用 API 客戶端
 *
 * 封裝 HTTP fetch 呼叫，提供型別安全與常用預設值。
 */

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  /** JSON body（自動序列化） */
  body?: Record<string, unknown> | unknown[];
  /** 自訂 headers（合併至預設 headers） */
  headers?: Record<string, string>;
}

/**
 * 建立綁定至特定 baseUrl 的 API 客戶端。
 *
 * @example
 *   const api = createApiClient('http://127.0.0.1:54321');
 *   const res = await api.get('/health');
 *   const body = await api.json(res);
 */
export function createApiClient(baseUrl: string) {
  async function request(
    path: string,
    options: ApiOptions = {},
  ): Promise<Response> {
    const { body, headers: extraHeaders, ...rest } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    return fetch(`${baseUrl}${path}`, {
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...rest,
    });
  }

  return {
    /** 原始 request（自訂 method） */
    request,

    /** GET 請求 */
    get: (path: string, headers?: Record<string, string>) =>
      request(path, { method: 'GET', headers }),

    /** POST 請求（含 JSON body） */
    post: (path: string, body?: Record<string, unknown>, headers?: Record<string, string>) =>
      request(path, { method: 'POST', body, headers }),

    /** PATCH 請求 */
    patch: (path: string, body?: Record<string, unknown>, headers?: Record<string, string>) =>
      request(path, { method: 'PATCH', body, headers }),

    /** DELETE 請求 */
    delete: (path: string, headers?: Record<string, string>) =>
      request(path, { method: 'DELETE', headers }),

    /** 安全地解析 JSON body（型別斷言） */
    json: async <T = Record<string, unknown>>(res: Response): Promise<T> => {
      return (await res.json()) as T;
    },
  };
}

/** API 客戶端型別 */
export type ApiClient = ReturnType<typeof createApiClient>;
