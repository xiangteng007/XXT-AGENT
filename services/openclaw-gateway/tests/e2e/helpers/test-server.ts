/**
 * test-server.ts — D-1: 獨立 HTTP Server 啟動器
 *
 * 為每個 E2E 測試場景建立獨立的 Express app + HTTP server。
 * 使用隨機 port 避免與開發 server 或其他測試衝突。
 *
 * 使用方式：
 *   const { server, baseUrl, cleanup } = await createTestServer();
 *   // ... 測試 ...
 *   await cleanup();
 */

import * as http from 'http';

export interface TestServer {
  /** HTTP server 實例 */
  server: http.Server;
  /** 完整的 baseUrl（含 port），例如 http://127.0.0.1:54321 */
  baseUrl: string;
  /** 清理函數：關閉 server */
  cleanup: () => Promise<void>;
}

/**
 * 建立一個使用隨機 port 的測試 HTTP server。
 *
 * 內部 import('./app') 使用動態 import 確保每次呼叫取得
 * 獨立的 module registry（配合 vitest isolate: true）。
 */
export async function createTestServer(): Promise<TestServer> {
  // 動態 import — 在 isolate 模式下每個 test file 取得獨立的 app
  const { app } = await import('../../../src/app');

  const server = http.createServer(app);

  const baseUrl = await new Promise<string>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve(`http://127.0.0.1:${addr.port}`);
      } else {
        reject(new Error('Failed to get server address'));
      }
    });

    server.on('error', reject);
  });

  const cleanup = async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };

  return { server, baseUrl, cleanup };
}
