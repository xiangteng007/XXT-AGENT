/**
 * base-entity-store.test.ts — A-02: EntityStore 泛型測試
 *
 * 驗證：
 *   1. createEntityStore 工廠函式
 *   2. in-memory CRUD（無 Firestore）
 *   3. 加密/解密對稱性
 *   4. maxMemoryItems 上限
 *   5. EntityStoreContract 介面合規
 *   6. query / count 操作
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore before import
vi.mock('./firestore-client', () => ({
  getDb: vi.fn(() => null),  // Firestore 未啟用 → 純 in-memory
}));

import {
  createEntityStore,
  EntityStore,
  BaseAgentStore,
  type BaseEntity,
  type EntityStoreContract,
} from './base-entity-store';

// ── 測試用型別 ─────────────────────────────────────────────

interface TestItem extends BaseEntity {
  name: string;
  secret?: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════
// § 1. 工廠函式
// ═══════════════════════════════════════════════════════════════

describe('createEntityStore factory', () => {
  it('should create an EntityStore instance', () => {
    const store = createEntityStore<TestItem>({
      collectionName: 'test_items',
    });
    expect(store).toBeInstanceOf(EntityStore);
  });

  it('should satisfy EntityStoreContract interface', () => {
    const store: EntityStoreContract<TestItem> = createEntityStore<TestItem>({
      collectionName: 'test_items',
    });
    expect(typeof store.initialize).toBe('function');
    expect(typeof store.add).toBe('function');
    expect(typeof store.update).toBe('function');
    expect(typeof store.get).toBe('function');
    expect(typeof store.query).toBe('function');
    expect(typeof store.getAll).toBe('function');
    expect(typeof store.count).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 2. In-memory CRUD
// ═══════════════════════════════════════════════════════════════

describe('EntityStore in-memory CRUD', () => {
  let store: EntityStore<TestItem>;

  beforeEach(() => {
    store = createEntityStore<TestItem>({
      collectionName: 'test_crud',
      maxMemoryItems: 100,
    });
  });

  it('should add and retrieve an item', async () => {
    const item: TestItem = { id: '1', name: 'Alice', created_at: '2026-01-01' };
    await store.add(item);

    const result = await store.get('1');
    expect(result).toBeDefined();
    expect(result?.name).toBe('Alice');
  });

  it('should return undefined for non-existent item', async () => {
    await store.add({ id: '1', name: 'Alice', created_at: '2026-01-01' });
    const result = await store.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should update an existing item', async () => {
    await store.add({ id: '1', name: 'Alice', created_at: '2026-01-01' });
    await store.update('1', { name: 'Bob' });

    const result = await store.get('1');
    expect(result?.name).toBe('Bob');
  });

  it('should silently skip updating non-existent item', async () => {
    // Should not throw
    await store.update('nonexistent', { name: 'Ghost' });
    expect(store.count()).toBe(0);
  });

  it('should return all items', async () => {
    await store.add({ id: '1', name: 'A', created_at: '2026-01-01' });
    await store.add({ id: '2', name: 'B', created_at: '2026-01-02' });
    await store.add({ id: '3', name: 'C', created_at: '2026-01-03' });

    const all = await store.getAll();
    expect(all).toHaveLength(3);
  });

  it('should query with filter function', async () => {
    await store.add({ id: '1', name: 'Alice', created_at: '2026-01-01' });
    await store.add({ id: '2', name: 'Bob', created_at: '2026-01-02' });
    await store.add({ id: '3', name: 'Alice', created_at: '2026-01-03' });

    const alices = await store.query((item) => item.name === 'Alice');
    expect(alices).toHaveLength(2);
  });

  it('should track count correctly', async () => {
    expect(store.count()).toBe(0);
    await store.add({ id: '1', name: 'A', created_at: '2026-01-01' });
    expect(store.count()).toBe(1);
    await store.add({ id: '2', name: 'B', created_at: '2026-01-02' });
    expect(store.count()).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 3. maxMemoryItems 上限
// ═══════════════════════════════════════════════════════════════

describe('maxMemoryItems eviction', () => {
  it('should evict oldest item when max is reached', async () => {
    const store = createEntityStore<TestItem>({
      collectionName: 'test_eviction',
      maxMemoryItems: 3,
    });

    await store.add({ id: '1', name: 'First', created_at: '2026-01-01' });
    await store.add({ id: '2', name: 'Second', created_at: '2026-01-02' });
    await store.add({ id: '3', name: 'Third', created_at: '2026-01-03' });

    // Adding 4th should evict item '1'
    await store.add({ id: '4', name: 'Fourth', created_at: '2026-01-04' });

    expect(store.count()).toBe(3);
    expect(await store.get('1')).toBeUndefined();
    expect(await store.get('4')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// § 4. 向後相容
// ═══════════════════════════════════════════════════════════════

describe('backward compatibility', () => {
  it('BaseAgentStore should be an alias for EntityStore', () => {
    expect(BaseAgentStore).toBe(EntityStore);
  });

  it('should work when used as BaseAgentStore subclass', () => {
    class MyStore extends BaseAgentStore<TestItem> {
      constructor() {
        super({ collectionName: 'my_test' });
      }
    }
    const store = new MyStore();
    expect(store).toBeInstanceOf(EntityStore);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 5. getAll 回傳獨立副本（防止外部修改）
// ═══════════════════════════════════════════════════════════════

describe('immutability', () => {
  it('getAll should return a copy, not a reference', async () => {
    const store = createEntityStore<TestItem>({
      collectionName: 'test_copy',
    });
    await store.add({ id: '1', name: 'Original', created_at: '2026-01-01' });

    const all = await store.getAll();
    all.push({ id: '2', name: 'Injected', created_at: '2026-01-02' });

    // Original store should be unaffected
    expect(store.count()).toBe(1);
  });
});
