/**
 * E2E Test Setup — D-1: 全局測試環境變數設定
 *
 * 在所有 E2E 測試檔案執行前載入。
 * 設定認證繞過、測試模式、與 mock 服務端點。
 */

// Auth bypass — 讓所有保護路由可在測試中存取
process.env['DEV_BYPASS_AUTH'] = 'true';
process.env['NODE_ENV'] = 'test';

// Gateway 內部 URL — E2E 測試會動態設定 port
// 設為空值讓各測試自行配置
process.env['GATEWAY_INTERNAL_URL'] = '';

// Ollama — 不應嘗試連線真實服務
process.env['OLLAMA_BASE_URL'] = 'http://mock-ollama:11434';

// Firebase — 測試模式（不初始化真實 Firebase Admin）
process.env['FIREBASE_PROJECT_ID'] = 'xxt-agent-test';
