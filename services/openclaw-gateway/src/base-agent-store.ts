import * as crypto from 'crypto';
import { logger } from './logger';
import type { EntityType } from '@xxt-agent/types';

// ── 密碼學設定 ───────────────────────────────────────────
const ENCRYPTION_KEY = process.env['STORE_ENCRYPTION_KEY'];
const ALGORITHM = 'aes-256-gcm';

// CR-05: 啟動時驗證加密金鑰 — 拒絕全零預設值
if (ENCRYPTION_KEY) {
  if (ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    logger.error('[BaseAgentStore] STORE_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Run: npx tsx src/scripts/generate-encryption-key.ts');
    process.exit(1);
  }
  if (/^0+$/.test(ENCRYPTION_KEY)) {
    logger.error('[BaseAgentStore] STORE_ENCRYPTION_KEY is all-zeros (insecure default). Run: npx tsx src/scripts/generate-encryption-key.ts');
    process.exit(1);
  }
}

export interface StoreOptions {
  collectionName: string;
  maxMemoryItems?: number;
  encryptedFields?: string[];
}

export abstract class BaseAgentStore<T extends { id: string; entity_type?: EntityType }> {
  protected items: T[] = [];
  protected maxItems: number;
  protected collectionName: string;
  protected encryptedFields: string[];
  private _db: FirebaseFirestore.Firestore | null = null;
  private _initialized = false;

  constructor(options: StoreOptions) {
    this.collectionName = options.collectionName;
    this.maxItems = options.maxMemoryItems ?? 2000;
    this.encryptedFields = options.encryptedFields ?? [];
  }

  // ── Firestore 參照（從單例取得）────────────────────────────
  protected getDb(): FirebaseFirestore.Firestore | null {
    if (this._db) return this._db;
    const { getDb: getFirestoreDb } = require('./firestore-client') as typeof import('./firestore-client');
    this._db = getFirestoreDb();
    return this._db;
  }

  // ── 加解密模組 ─────────────────────────────────────────
  private encrypt(text: string): string {
    if (!ENCRYPTION_KEY) return text;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    return `${iv.toString('base64')}:${authTag}:${encrypted}`;
  }

  private decrypt(text: string): string {
    if (!ENCRYPTION_KEY || !text.includes(':')) return text;
    try {
      const [ivStr, authTagStr, encryptedStr] = text.split(':');
      if (!ivStr || !authTagStr || !encryptedStr) return text;
      
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY, 'hex'),
        Buffer.from(ivStr, 'base64')
      );
      decipher.setAuthTag(Buffer.from(authTagStr, 'base64'));
      let decrypted = decipher.update(encryptedStr, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      logger.error(`[BaseAgentStore] Decryption failed for ${this.collectionName}`);
      return text;
    }
  }

  protected processForStorage(item: T): Record<string, unknown> {
    const data = { ...item } as Record<string, unknown>;
    for (const field of this.encryptedFields) {
      if (data[field] && typeof data[field] === 'string') {
        data[field] = this.encrypt(data[field] as string);
      }
    }
    return data as T;
  }

  protected processFromStorage(data: unknown): T {
    const item = { ...(data as Record<string, unknown>) };
    for (const field of this.encryptedFields) {
      if (item[field] && typeof item[field] === 'string' && (item[field] as string).includes(':')) {
        item[field] = this.decrypt(item[field] as string);
      }
    }
    return item as T;
  }

  // ── 核心 CRUD ──────────────────────────────────────────

  /**
   * 初始化：將 Firestore 的資料回補到 Memory
   */
  public async initialize(): Promise<void> {
    if (this._initialized) return;
    const db = await this.getDb();
    if (!db) {
      logger.warn(`[BaseAgentStore] Firestore not available, running in-memory only for ${this.collectionName}`);
      this._initialized = true;
      return;
    }

    try {
      const snap = await db.collection(this.collectionName)
        .orderBy('created_at', 'desc')
        .limit(this.maxItems)
        .get();
      
      const loaded: T[] = [];
      snap.forEach(doc => {
        loaded.push(this.processFromStorage(doc.data()));
      });
      // Reverse to keep chronological order
      this.items = loaded.reverse();
      logger.info(`[BaseAgentStore] Restored ${this.items.length} items to ${this.collectionName}`);
    } catch (err) {
      logger.error(`[BaseAgentStore] Initialization failed for ${this.collectionName}: ${err}`);
    }
    
    this._initialized = true;
  }

  public async add(item: T): Promise<void> {
    if (!this._initialized) await this.initialize();

    if (this.items.length >= this.maxItems) {
      this.items.shift();
    }
    this.items.push(item);

    const db = await this.getDb();
    if (db) {
      try {
        await db.collection(this.collectionName)
          .doc(item.id)
          .set(this.processForStorage(item));
      } catch (err) {
        logger.warn(`[BaseAgentStore] Firestore sync failed for ${this.collectionName}: ${err}`);
      }
    }
  }

  public async update(id: string, updates: Partial<T>): Promise<void> {
    if (!this._initialized) await this.initialize();

    const idx = this.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.items[idx] = { ...this.items[idx], ...updates };
      
      const db = await this.getDb();
      if (db) {
        try {
          const docData = this.processForStorage(this.items[idx] as T);
          await db.collection(this.collectionName).doc(id).update(docData);
        } catch (err) {
          logger.warn(`[BaseAgentStore] Firestore update failed for ${this.collectionName}/${id}: ${err}`);
        }
      }
    }
  }

  public async get(id: string): Promise<T | undefined> {
    if (!this._initialized) await this.initialize();
    return this.items.find(i => i.id === id);
  }

  public async query(filterFn: (item: T) => boolean): Promise<T[]> {
    if (!this._initialized) await this.initialize();
    return this.items.filter(filterFn);
  }

  public async getAll(): Promise<T[]> {
    if (!this._initialized) await this.initialize();
    return [...this.items];
  }
}
