/**
 * migrate-entity-types.ts — Firestore 舊版 EntityType 遷移腳本
 *
 * 將 Firestore 中殘留的舊版 entity_type = 'company' 文件
 * 轉換為正確的 7 實體 EntityType（v6.0 規格）
 *
 * 執行方式（一次性手動執行，需要 Firebase Admin 憑證）：
 *   ts-node src/scripts/migrate-entity-types.ts [--dry-run] [--verbose]
 *
 * 安全策略：
 *   - 預設 --dry-run：只印出計畫，不寫入
 *   - 使用 description / category 欄位作為 hint 判斷目標實體
 *   - 每批次最多 400 筆（Firestore batch 上限 500）
 *   - 生成 migration_report.json 供審閱
 */

import * as fs from 'fs';
import * as path from 'path';
import { migrateLegacyEntity, type EntityType } from '../entity';

const DRY_RUN  = process.argv.includes('--dry-run') || !process.argv.includes('--execute');
const VERBOSE  = process.argv.includes('--verbose');
const BATCH_SZ = 400;

// ── Firestore Collections 需要遷移的集合列表 ──
const COLLECTIONS_TO_MIGRATE = [
  'bank_accounts',
  'bank_transactions',
  'ledger_entries',
  'loan_records',
  'insurance_policies',
] as const;

interface MigrationRecord {
  collection: string;
  doc_id:     string;
  old_entity: string;
  new_entity: EntityType;
  hint:       string;
  status:     'pending' | 'migrated' | 'skipped' | 'error';
  error?:     string;
}

async function getFirestore() {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore }                 = await import('firebase-admin/firestore');

  if (!getApps().length) {
    const credPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
    if (!credPath || !fs.existsSync(credPath)) {
      throw new Error(
        'GOOGLE_APPLICATION_CREDENTIALS 未設定或檔案不存在。\n' +
        '請設定環境變數後重新執行。\n' +
        '範例: $env:GOOGLE_APPLICATION_CREDENTIALS = "path/to/serviceAccount.json"',
      );
    }
    initializeApp({ credential: cert(credPath) });
  }
  return getFirestore();
}

async function migrateCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  report: MigrationRecord[],
): Promise<{ total: number; migrated: number; skipped: number; errors: number }> {
  const stats = { total: 0, migrated: 0, skipped: 0, errors: 0 };

  // 查詢舊版 entity_type
  const snap = await db.collection(collectionName)
    .where('entity_type', 'in', ['company'])
    .get();

  if (snap.empty) {
    console.log(`  [${collectionName}] 無需遷移`);
    return stats;
  }

  stats.total = snap.docs.length;
  console.log(`  [${collectionName}] 找到 ${stats.total} 筆舊版文件`);

  // 分批處理
  const batches: FirebaseFirestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const oldEntity = String(data['entity_type'] ?? '');

    if (oldEntity !== 'company') {
      stats.skipped++;
      report.push({
        collection: collectionName, doc_id: doc.id,
        old_entity: oldEntity, new_entity: 'co_construction',
        hint: '', status: 'skipped',
      });
      continue;
    }

    // 建立 hint：合併 description / category / notes 欄位
    const hint = [
      data['description'], data['category'], data['notes'],
      data['bank_name'], data['account_holder'], data['loan_name'],
    ]
      .filter(Boolean)
      .join(' ');

    const newEntity = migrateLegacyEntity('company', hint);

    const record: MigrationRecord = {
      collection: collectionName, doc_id: doc.id,
      old_entity: oldEntity, new_entity: newEntity,
      hint: hint.slice(0, 100), status: 'pending',
    };

    if (VERBOSE) {
      console.log(`    ${doc.id}: company → ${newEntity} (hint: "${hint.slice(0, 60)}")`);
    }

    if (!DRY_RUN) {
      try {
        currentBatch.update(doc.ref, {
          entity_type: newEntity,
          migrated_at: new Date().toISOString(),
          migration_from: 'company',
        });
        batchCount++;
        record.status = 'migrated';

        if (batchCount >= BATCH_SZ) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }
        stats.migrated++;
      } catch (err) {
        record.status = 'error';
        record.error  = String(err);
        stats.errors++;
        console.error(`    ERROR ${doc.id}: ${err}`);
      }
    } else {
      record.status = 'migrated'; // dry-run 中標示「預計更新」
      stats.migrated++;
    }

    report.push(record);
  }

  if (!DRY_RUN && batchCount > 0) {
    batches.push(currentBatch);
  }

  // 提交所有 batch
  if (!DRY_RUN) {
    for (let i = 0; i < batches.length; i++) {
      await batches[i]!.commit();
      console.log(`  [${collectionName}] 已提交批次 ${i + 1}/${batches.length}`);
    }
  }

  return stats;
}

async function main() {
  console.log('='.repeat(60));
  console.log('XXT-AGENT EntityType 遷移腳本 v6.0');
  console.log(`模式: ${DRY_RUN ? '🔍 DRY-RUN（不寫入）' : '✍️  EXECUTE（實際寫入）'}`);
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY-RUN 模式：只顯示計畫，不修改 Firestore。');
    console.log('   加上 --execute 參數才會實際寫入。\n');
  }

  const report: MigrationRecord[] = [];

  try {
    const db = await getFirestore();

    let totalStats = { total: 0, migrated: 0, skipped: 0, errors: 0 };

    for (const col of COLLECTIONS_TO_MIGRATE) {
      console.log(`\n處理集合: ${col}`);
      const stats = await migrateCollection(db, col, report);
      totalStats.total    += stats.total;
      totalStats.migrated += stats.migrated;
      totalStats.skipped  += stats.skipped;
      totalStats.errors   += stats.errors;
    }

    console.log('\n' + '='.repeat(60));
    console.log('遷移摘要：');
    console.log(`  總文件數:  ${totalStats.total}`);
    console.log(`  預計更新:  ${totalStats.migrated}`);
    console.log(`  跳過:      ${totalStats.skipped}`);
    console.log(`  錯誤:      ${totalStats.errors}`);
    console.log('='.repeat(60));

    // 寫出報告
    const reportPath = path.join(process.cwd(), 'migration_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      executed_at: new Date().toISOString(),
      dry_run: DRY_RUN,
      stats: totalStats,
      records: report,
    }, null, 2));
    console.log(`\n📋 報告已輸出至: ${reportPath}`);

    if (DRY_RUN && totalStats.total > 0) {
      console.log('\n👆 確認無誤後，執行以下命令進行實際遷移：');
      console.log('   ts-node src/scripts/migrate-entity-types.ts --execute');
    }

  } catch (err) {
    console.error('\n❌ 遷移失敗：', err);
    process.exit(1);
  }
}

main();
