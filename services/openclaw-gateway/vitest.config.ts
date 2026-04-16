/**
 * vitest.config.ts — H-02: Gateway 自動化測試設定
 *
 * - isolate: true  => 各 test 文件使用獨立的 module registry，
 *   防止多個 integration test 文件共用同一個 Express app 實例
 *   造成 state pollution 或 beforeAll race condition。
 * - testTimeout: 30000 => 容納 beforeAll 動態 import('./app') 的啟動時間
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: true,   // T-01: 各 test file 模組獨立（防止 app 狀態共用）
    pool: 'forks',   // Fix: require() inside vitest ESM context needs forks pool
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/scripts/**'],
    },
    testTimeout: 30000,  // 30 秒（integration test 含 beforeAll import）
  },
});

