/**
 * mock-firestore.ts — D-1: Firestore In-Memory Mock
 *
 * 使用 Map 模擬 Firestore 的基本 CRUD 操作。
 * E2E 測試不應依賴真實 Firestore emulator，
 * 本 mock 提供足夠的語義模擬以驗證業務邏輯。
 *
 * 覆蓋的 Firestore API：
 *   - collection(name).doc(id).set(data)
 *   - collection(name).doc(id).get()
 *   - collection(name).add(data)
 *   - collection(name).where(...).limit(n).get()
 */

type DocumentData = Record<string, unknown>;

class MockDocumentReference {
  constructor(
    private store: Map<string, Map<string, DocumentData>>,
    private collectionName: string,
    private docId: string,
  ) {}

  async set(data: DocumentData, options?: { merge?: boolean }): Promise<void> {
    let collection = this.store.get(this.collectionName);
    if (!collection) {
      collection = new Map();
      this.store.set(this.collectionName, collection);
    }

    if (options?.merge) {
      const existing = collection.get(this.docId) ?? {};
      collection.set(this.docId, { ...existing, ...data });
    } else {
      collection.set(this.docId, { ...data });
    }
  }

  async get(): Promise<{ exists: boolean; data: () => DocumentData | undefined; id: string }> {
    const collection = this.store.get(this.collectionName);
    const doc = collection?.get(this.docId);
    return {
      exists: !!doc,
      data: () => doc,
      id: this.docId,
    };
  }

  async delete(): Promise<void> {
    const collection = this.store.get(this.collectionName);
    collection?.delete(this.docId);
  }
}

class MockQuery {
  private filters: Array<{ field: string; op: string; value: unknown }> = [];
  private _limit: number = Infinity;

  constructor(
    private store: Map<string, Map<string, DocumentData>>,
    private collectionName: string,
  ) {}

  where(field: string, op: string, value: unknown): MockQuery {
    this.filters.push({ field, op, value });
    return this;
  }

  limit(n: number): MockQuery {
    this._limit = n;
    return this;
  }

  async get(): Promise<{ empty: boolean; docs: Array<{ id: string; data: () => DocumentData }> }> {
    const collection = this.store.get(this.collectionName);
    if (!collection) {
      return { empty: true, docs: [] };
    }

    let results = Array.from(collection.entries());

    // Apply filters
    for (const filter of this.filters) {
      results = results.filter(([_id, data]) => {
        const val = data[filter.field];
        switch (filter.op) {
          case '==': return val === filter.value;
          case '!=': return val !== filter.value;
          case '>':  return (val as number) > (filter.value as number);
          case '<':  return (val as number) < (filter.value as number);
          case '>=': return (val as number) >= (filter.value as number);
          case '<=': return (val as number) <= (filter.value as number);
          default: return true;
        }
      });
    }

    // Apply limit
    results = results.slice(0, this._limit);

    const docs = results.map(([id, data]) => ({
      id,
      data: () => ({ ...data }),
    }));

    return { empty: docs.length === 0, docs };
  }
}

class MockCollectionReference {
  constructor(
    private store: Map<string, Map<string, DocumentData>>,
    private collectionName: string,
  ) {}

  doc(docId: string): MockDocumentReference {
    return new MockDocumentReference(this.store, this.collectionName, docId);
  }

  async add(data: DocumentData): Promise<MockDocumentReference> {
    const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ref = new MockDocumentReference(this.store, this.collectionName, id);
    await ref.set(data);
    return ref;
  }

  where(field: string, op: string, value: unknown): MockQuery {
    const query = new MockQuery(this.store, this.collectionName);
    return query.where(field, op, value);
  }
}

/**
 * 建立一個 in-memory Firestore mock 實例。
 *
 * @example
 *   const { db, reset } = createMockFirestore();
 *   await db.collection('ledger').doc('e1').set({ amount: 1000 });
 *   const snap = await db.collection('ledger').doc('e1').get();
 *   console.log(snap.data()); // { amount: 1000 }
 *   reset(); // 清空所有資料
 */
export function createMockFirestore() {
  const store = new Map<string, Map<string, DocumentData>>();

  const db = {
    collection: (name: string) => new MockCollectionReference(store, name),
  };

  const reset = () => store.clear();

  /**
   * 預載入測試資料。
   */
  const seed = async (collectionName: string, docs: Array<{ id: string; data: DocumentData }>) => {
    for (const doc of docs) {
      await db.collection(collectionName).doc(doc.id).set(doc.data);
    }
  };

  /**
   * 取得所有集合的快照（偵錯用）。
   */
  const snapshot = (): Record<string, DocumentData[]> => {
    const result: Record<string, DocumentData[]> = {};
    for (const [name, collection] of store) {
      result[name] = Array.from(collection.values());
    }
    return result;
  };

  return { db, reset, seed, snapshot };
}

export type MockFirestoreDb = ReturnType<typeof createMockFirestore>['db'];
