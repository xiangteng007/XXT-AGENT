/**
 * .lighthouserc.js — F-03: Lighthouse CI 設定
 * 
 * 基準門檻：
 *  - Performance: 80+
 *  - Accessibility: 90+
 */

module.exports = {
  ci: {
    collect: {
      // 啟動生產環境 server 進行測試
      startServerCommand: 'npm run start',
      url: ['http://localhost:3000/'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        // 額外規範：PWA 可選，Best Practices 與 SEO 設為 warn
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
      },
    },
    upload: {
      target: 'temporary-public-storage', // 上傳至公共儲存以便在 PR 預覽
    },
  },
};
