/**
 * base-entity-store.ts — A-02: 泛型強化的 EntityStore 工廠
 *
 * 設計目標：
 *   1. 消除所有 Store 子類別的模板化程式碼（純 constructor 調用 → 工廠函式）
 *   2. 強化 processForStorage / processFromStorage 的型別安全
 *   3. 提供 createEntityStore<T>() 工廠，一行創建型別安全的 Store
 *   4. 維持向後相容：BaseAgentStore 重新匯出為 alias
 *
 * 遷移路徑：
 *   - 新代碼使用 createEntityStore<T>() 工廠
 *   - 舊代碼的 `extends BaseAgentStore<T>` 繼續運作
 */

import * as crypto from 'crypto';
import { logger } from './logger';
import type { EntityType } from '@xxt-agent/types';

// ── 密碼學設定 ───────────────────────────────────────────
const ENCRYPTION_KEY = process.env['STORE_ENCRYPTION_KEY'];
const ALGORITHM = 'aes-256-gcm';

// CR-05: 啟動時驗證加密金鑰 — 拒絕全零預設值
if (ENCRYPTION_KEY) {
  if (ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    logger.error('[EntityStore] STORE_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Run: npx tsx src/scripts/generate-encryption-key.ts');
    process.exit(1);
  }
  if (/^0+$/.test(ENCRYPTION_KEY)) {
    logger.error('[EntityStore] STORE_ENCRYPTION_KEY is all-zeros (insecure default). Run: npx tsx src/scripts/generate-encryption-key.ts');
    process.exit(1);
  }
}

// ── 型別定義 ──────────────────────────────────────────────

/** 所有 Entity Store 物件的最小介面約束 */
export interface BaseEntity {
  id: string;
  entity_type?: EntityType;
}

export interface StoreOptions {
  collectionName: string;
  maxMemoryItems?: number;
  encryptedFields?: string[];
}

/** Store 的公開 CRUD 介面（只讀版可用於 DI） */
export interface EntityStoreContract<T extends BaseEntity> {
  initialize(): Promise<void>;
  add(item: T): Promise<void>;
  update(id: string, updates: Partial<T>): Promise<void>;
  get(id: string): Promise<T | undefined>;
  query(filterFn: (item: T) => boolean): Promise<T[]>;
  getAll(): Promise<T[]>;
  count(): number;
}

// ── 加密模組 ──────────────────────────────────────────────

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}

function decrypt(text: string, collectionName: string): string {
  if (!ENCRYPTION_KEY || !text.includes(':')) return text;
  try {
    const [ivStr, authTagStr, encryptedStr] = text.split(':');
    if (!ivStr || !authTagStr || !encryptedStr) return text;

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      Buffer.from(ivStr, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagStr, 'base64'));
    let decrypted = decipher.update(encryptedStr, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    logger.error(`[EntityStore] Decryption failed for ${collectionName}`);
    return text;
  }
}

// ── 存儲處理（加解密） ───────────────────────────────────

function processForStorage<T extends BaseEntity>(item: T, fields: string[]): Record<string, unknown> {
  const data = { ...item } as Record<string, unknown>;
  for (const field of fields) {
    if (data[field] && typeof data[field] === 'string') {
      data[field] = encrypt(data[field] as string);
    }
  }
  return data;
}

function processFromStorage<T extends BaseEntity>(
  data: Record<string, unknown>,
  fields: string[],
  collectionName: string,
): T {
  const item = { ...data };
  for (const field of fields) {
    if (item[field] && typeof item[field] === 'string' && (item[field] as string).includes(':')) {
      item[field] = decrypt(item[field] as string, collectionName);
    }
  }
  return item as unknown as T;
}

// ── 核心 Store 類別 ──────────────────────────────────────

export class EntityStore<T extends BaseEntity> implements EntityStoreContract<T> {
  protected items: T[] = [];
  protected readonly maxItems: number;
  protected readonly collectionName: string;
  protected readonly encryptedFields: string[];
  private _db: FirebaseFirestore.Firestore | null = null;
  private _initialized = false;

  constructor(options: StoreOptions) {
    this.collectionName = options.collectionName;
    this.maxItems = options.maxMemoryItems ?? 2000;
    this.encryptedFields = options.encryptedFields ?? [];
  }

  // ── Firestore 參照（lazy init）─────────────────────────
  protected getDb(): FirebaseFirestore.Firestore | null {
    if (this._db) return this._db;
    try {
      const { getDb: getFirestoreDb } = require('./firestore-client') as typeof import('./firestore-client');
      this._db = getFirestoreDb();
    } catch {
      // Firestore client unavailable (test environment or no config)
      return null;
    }
    return this._db;
  }

  // ── CRUD ──────────────────────────────────────────────

  public async initialize(): Promise<void> {
    if (this._initialized) return;
    const db = this.getDb();
    if (!db) {
      logger.warn(`[EntityStore] Firestore not available, running in-memory only for ${this.collectionName}`);
      this._initialized = true;
      return;
    }

    try {
      const snap = await db.collection(this.collectionName)
        .orderBy('created_at', 'desc')
        .limit(this.maxItems)
        .get();

      const loaded: T[] = [];
      snap.forEach((doc) => {
        loaded.push(processFromStorage<T>(doc.data() as Record<string, unknown>, this.encryptedFields, this.collectionName));
      });
      this.items = loaded.reverse();
      logger.info(`[EntityStore] Restored ${this.items.length} items to ${this.collectionName}`);
    } catch (err) {
      logger.error(`[EntityStore] Initialization failed for ${this.collectionName}: ${err}`);
    }

    this._initialized = true;
  }

  public async add(item: T): Promise<void> {
    if (!this._initialized) await this.initialize();

    if (this.items.length >= this.maxItems) {
      this.items.shift();
    }
    this.items.push(item);

    const db = this.getDb();
    if (db) {
      try {
        await db.collection(this.collectionName)
          .doc(item.id)
          .set(processForStorage(item, this.encryptedFields));
      } catch (err) {
        logger.warn(`[EntityStore] Firestore sync failed for ${this.collectionName}: ${err}`);
      }
    }
  }

  public async update(id: string, updates: Partial<T>): Promise<void> {
    if (!this._initialized) await this.initialize();

    const idx = this.items.findIndex((i) => i.id === id);
    if (idx !== -1) {
      this.items[idx] = { ...this.items[idx], ...updates };

      const db = this.getDb();
      if (db) {
        try {
          const docData = processForStorage(this.items[idx]!, this.encryptedFields);
          await db.collection(this.collectionName).doc(id).update(docData);
        } catch (err) {
          logger.warn(`[EntityStore] Firestore update failed for ${this.collectionName}/${id}: ${err}`);
        }
      }
    }
  }

  public async get(id: string): Promise<T | undefined> {
    if (!this._initialized) await this.initialize();
    return this.items.find((i) => i.id === id);
  }

  public async query(filterFn: (item: T) => boolean): Promise<T[]> {
    if (!this._initialized) await this.initialize();
    return this.items.filter(filterFn);
  }

  public async getAll(): Promise<T[]> {
    if (!this._initialized) await this.initialize();
    return [...this.items];
  }

  /** 當前記憶體快取數量 */
  public count(): number {
    return this.items.length;
  }
}

// ═══════════════════════════════════════════════════════════════
// A-02: 泛型工廠函式 — 消除純模板化子類別
// ═══════════════════════════════════════════════════════════════

/**
 * 一行建立型別安全的 EntityStore
 *
 * @example
 * ```ts
 * interface MyEntity extends BaseEntity {
 *   name: string;
 *   secret: string;
 * }
 *
 * const myStore = createEntityStore<MyEntity>({
 *   collectionName: 'my_collection',
 *   maxMemoryItems: 500,
 *   encryptedFields: ['secret'],
 * });
 * ```
 */
export function createEntityStore<T extends BaseEntity>(options: StoreOptions): EntityStore<T> {
  return new EntityStore<T>(options);
}

// ═══════════════════════════════════════════════════════════════
// 向後相容：BaseAgentStore alias
// ═══════════════════════════════════════════════════════════════

/** @deprecated Use EntityStore or createEntityStore instead */
export { EntityStore as BaseAgentStore };
