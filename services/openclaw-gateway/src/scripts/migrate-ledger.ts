/**
 * A-05: Firestore 帳本遷移腳本
 *
 * 將已存在於 Firestore accountant_ledger collection 的舊格式帳本資料
 * 遷移至 v6.0 格式（含 entity_type 欄位補全、EntityType 標準化）。
 *
 * 執行前確認：
 *   1. GOOGLE_APPLICATION_CREDENTIALS 環境變數已設定
 *   2. 先以 --dry-run 模式預覽，確認無誤後再正式執行
 *
 * 執行方式：
 *   npx tsx services/openclaw-gateway/src/scripts/migrate-ledger.ts --dry-run
 *   npx tsx services/openclaw-gateway/src/scripts/migrate-ledger.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

const IS_DRY_RUN = process.argv.includes('--dry-run');
const COLLECTION = 'accountant_ledger';

// v6.0 合法的 EntityType 值
const VALID_ENTITY_TYPES = ['company', 'personal', 'family', 'co_build', 'co_design', 'co_drone', 'assoc_rescue'];

// 舊格式映射（相容性）
const ENTITY_TYPE_MAP: Record<string, string> = {
  'senteng':     'company',
  'individual':  'personal',
  'household':   'family',
  'xxt':         'company',
  '':            'company',
};

interface LedgerDocV5 {
  entity_type?: string;
  type?: string;
  category?: string;
  amount_taxed?: number;
  company_id?: string;
  // ...其餘欄位
}

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

async function migrate(): Promise<void> {
  console.log(`\n📂 Firestore 帳本遷移 — XXT-AGENT v6.0`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`模式: ${IS_DRY_RUN ? '🔍 DRY RUN（不實際寫入）' : '🚀 正式遷移'}`);
  console.log(`Collection: ${COLLECTION}\n`);

  // 初始化 Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  const result: MigrationResult = { total: 0, migrated: 0, skipped: 0, errors: 0 };

  // 分批讀取（每批 500 筆）
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  const BATCH_SIZE = 500;

  while (true) {
    let query: admin.firestore.Query = db.collection(COLLECTION)
      .orderBy('created_at')
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    console.log(`📦 讀取 ${snapshot.size} 筆資料（第 ${result.total + 1} ~ ${result.total + snapshot.size} 筆）`);

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      result.total++;
      const data = doc.data() as LedgerDocV5;

      // 決定是否需要遷移
      const currentEntityType = data.entity_type ?? '';
      let newEntityType: string | null = null;

      if (VALID_ENTITY_TYPES.includes(currentEntityType)) {
        // 已是合法 v6.0 值
        result.skipped++;
        continue;
      }

      // 嘗試映射舊值
      if (ENTITY_TYPE_MAP[currentEntityType] !== undefined) {
        newEntityType = ENTITY_TYPE_MAP[currentEntityType] ?? 'company';
      } else {
        // 無法映射，標記為預設
        newEntityType = 'company';
        console.warn(`  ⚠️ 無法映射 entity_type="${currentEntityType}" for doc ${doc.id}，使用預設 'company'`);
      }

      if (!IS_DRY_RUN) {
        batch.update(doc.ref, {
          entity_type:    newEntityType,
          _migrated_v6:   true,
          _migrated_at:   admin.firestore.FieldValue.serverTimestamp(),
          _original_entity_type: currentEntityType,
        });
        batchCount++;
      }

      console.log(`  ${IS_DRY_RUN ? '🔍' : '✏️ '} doc ${doc.id}: entity_type "${currentEntityType}" → "${newEntityType}"`);
      result.migrated++;
    }

    // 批次寫入（最多 500 筆）
    if (!IS_DRY_RUN && batchCount > 0) {
      await batch.commit();
      console.log(`  ✅ 批次寫入 ${batchCount} 筆成功`);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    if (snapshot.size < BATCH_SIZE) break;
  }

  // ── 結果報告 ──────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 遷移完成`);
  console.log(`   總計: ${result.total} 筆`);
  console.log(`   遷移: ${result.migrated} 筆`);
  console.log(`   跳過: ${result.skipped} 筆（已是 v6.0 格式）`);
  console.log(`   錯誤: ${result.errors} 筆`);
  if (IS_DRY_RUN) {
    console.log(`\n💡 DRY RUN 完成！確認無誤後請移除 --dry-run 參數正式執行。`);
  }
  console.log(`${'─'.repeat(50)}\n`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
