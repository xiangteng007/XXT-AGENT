/**
 * vitest.e2e.config.ts — D-1: E2E 測試專用配置
 *
 * 與主 vitest.config.ts 分離，確保 E2E 測試有獨立的配置：
 *   - isolate: true  → 每個測試檔案使用獨立的 Express app 實例
 *   - testTimeout: 60s → E2E 需要更長的超時（含 server 啟動 + HTTP 請求）
 *   - 環境變數預設 → DEV_BYPASS_AUTH=true, NODE_ENV=test
 *
 * 執行方式：
 *   npm run test:e2e
 *   npx vitest run --config tests/e2e/vitest.e2e.config.ts
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: true,
    include: ['tests/e2e/scenarios/**/*.e2e.ts'],
    setupFiles: ['tests/e2e/helpers/setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/scripts/**'],
    },
    testTimeout: 60_000,  // 60s — E2E 含 server 啟動
    hookTimeout: 30_000,  // 30s — beforeAll/afterAll
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, '../../src'),
    },
  },
});
