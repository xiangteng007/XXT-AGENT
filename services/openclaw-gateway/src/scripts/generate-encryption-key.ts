/**
 * generate-encryption-key.ts — 安全隨機加密金鑰產生器
 *
 * CR-05: 提供開發者一鍵產出 AES-256-GCM 所需的 32 byte hex 金鑰。
 *
 * 使用方式：
 *   npx tsx src/scripts/generate-encryption-key.ts
 *
 * 輸出的金鑰應貼入 .env 檔案的 STORE_ENCRYPTION_KEY 欄位。
 */

import * as crypto from 'crypto';

const key = crypto.randomBytes(32).toString('hex');

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  XXT-AGENT — AES-256-GCM 加密金鑰產生器');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('  新金鑰（64 hex chars）：');
console.log(`  ${key}`);
console.log('');
console.log('  請將以下行貼入 .env 檔案：');
console.log(`  STORE_ENCRYPTION_KEY=${key}`);
console.log('');
console.log('  ⚠️  注意：更換金鑰後，已加密的資料將無法解密。');
console.log('      請在變更前備份 Firestore 資料。');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
