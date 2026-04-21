/**
 * firestore-client.ts — Firestore 單例連線管理器
 *
 * CR-01: 消除全專案 5 處碎片化 require('firebase-admin') 調用，
 * 統一為單一匯出的 Firestore 實例。
 *
 * 設計原則：
 *   - 單次初始化，所有模組共用同一個 db 實例
 *   - 懶載入：首次呼叫 getDb() 時才初始化
 *   - 連線失敗降級為 null（不阻塞主流程）
 *   - 匯出可替換的 mock（測試用）
 */

import { logger } from './logger';

let _db: FirebaseFirestore.Firestore | null = null;
let _initAttempted = false;

/**
 * 取得 Firestore 實例（懶初始化，單例）。
 * 若 Firebase Admin 未設定或初始化失敗，回傳 null。
 */
export function getDb(): FirebaseFirestore.Firestore | null {
  if (_db) return _db;
  if (_initAttempted) return null; // 已嘗試過且失敗，不再重試

  _initAttempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin') as typeof import('firebase-admin');

    if (!admin.apps.length) {
      const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
      const projectId = process.env['FIREBASE_PROJECT_ID'] ?? 'xxt-agent';

      if (serviceAccountJson) {
        try {
          const { cert } = admin.credential;
          const serviceAccount = JSON.parse(serviceAccountJson) as object;
          admin.initializeApp({ credential: cert(serviceAccount) });
        } catch {
          logger.warn('[FirestoreClient] Service account JSON parse failed, using ADC');
          admin.initializeApp({ projectId });
        }
      } else {
        admin.initializeApp({ projectId });
      }
    }

    _db = admin.firestore();
    _db.settings({ ignoreUndefinedProperties: true });
    logger.info('[FirestoreClient] Firestore initialized successfully');
    return _db;
  } catch (err) {
    logger.warn(`[FirestoreClient] Firestore not available: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * 健康檢查：回傳 Firestore 是否可用
 */
export function isFirestoreAvailable(): boolean {
  return _db !== null;
}

/**
 * 重置單例（僅供測試用）
 */
export function _resetForTesting(): void {
  _db = null;
  _initAttempted = false;
}
