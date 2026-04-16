# ADR-10: Multi-tenant SaaS 架構設計

|          |                              |
|----------|------------------------------|
| **Status**   | Proposed                 |
| **Date**     | 2026-04-16               |
| **Author**   | Opus 4.6 (System Architect) |
| **Deciders** | XXT-AGENT Core Team      |
| **Tags**     | E-5, SaaS, Architecture  |

---

## Context

XXT-AGENT 目前為**單租戶**架構，所有 Firestore 集合、推理引擎、Agent 共享同一組資源。v8.0 的企劃書提出將系統轉型為 SaaS 服務，讓多個營建公司/個人用戶可以獨立使用自己的 Agent 實例。

### 核心挑戰
1. **資料隔離**：不同租戶的帳本、合約、貸款記錄必須完全隔離
2. **認證**：每個租戶需要獨立的使用者管理
3. **計費**：按 Agent 呼叫次數收費
4. **資源公平**：防止單一租戶過度消耗推理資源

## Decision

### 1. 租戶隔離策略：**Collection Prefix + Tenant Middleware**

#### 選型分析

| 方案 | 隔離強度 | 成本增量 | 開發複雜度 | 遷移難度 | 適合階段 |
|------|---------|---------|-----------|---------|---------|
| A. Collection Prefix | 中 | $0 | 中 | 中 | **Phase 1** ✅ |
| B. 獨立 Firestore Project | 高 | $5-20/月/租戶 | 高 | 高 | Phase 3（企業版） |
| C. Row-Level Security | 低-中 | $0 | 低 | 低 | 不建議（Firestore 不原生支援） |
| D. 獨立 Cloud Run 實例 | 最高 | $15-50/月/租戶 | 最高 | 最高 | 旗艦企業版 |

**選定方案 A：Collection Prefix**（Phase 1 SaaS 上線）

```
Before (單租戶):
  Firestore/
    ledger_entries/{entry_id}
    loans/{loan_id}
    contracts/{contract_id}

After (多租戶):
  Firestore/
    tenants/{tenant_id}/ledger_entries/{entry_id}
    tenants/{tenant_id}/loans/{loan_id}
    tenants/{tenant_id}/contracts/{contract_id}
```

#### Tenant Middleware 設計

```typescript
/**
 * Tenant Middleware — 從 Firebase JWT 提取 tenant_id
 * 並注入至 req.tenantId，後續所有 Store 操作使用此 ID。
 */
export async function tenantMiddleware(
  req: Request, res: Response, next: NextFunction
) {
  const user = (req as any).user;
  if (!user?.tenant_id) {
    return res.status(403).json({ error: 'No tenant context' });
  }

  req.tenantId = user.tenant_id;
  req.tenantPrefix = `tenants/${user.tenant_id}`;
  next();
}

// Store 改造：
class LedgerStore extends BaseEntityStore {
  constructor(tenantPrefix: string) {
    super(`${tenantPrefix}/ledger_entries`);
    //      ^ 動態集合路徑
  }
}
```

### 2. 認證改造：**Firebase Auth Multi-tenancy**

```
┌──────────────────────────────────────────┐
│ Firebase Auth (Multi-tenancy mode)        │
│                                           │
│ Tenant: senteng                           │
│   ├─ user-001 (admin)                     │
│   └─ user-002 (viewer)                    │
│                                           │
│ Tenant: acme-construction                 │
│   ├─ user-003 (admin)                     │
│   └─ user-004 (viewer)                    │
│                                           │
│ JWT Claims:                               │
│   {                                       │
│     "uid": "user-001",                    │
│     "tenant_id": "senteng",               │
│     "role": "admin",                      │
│     "plan": "professional",               │
│     "scopes": ["ledger:*", "contract:*"]  │
│   }                                       │
└──────────────────────────────────────────┘
```

- 使用 Firebase Auth **Identity Platform** Multi-tenancy
- 每個租戶有獨立的 Auth tenant（隔離使用者命名空間）
- JWT Custom Claims 包含 `tenant_id`, `role`, `plan`, `scopes`
- 現有 `firebaseAuthMiddleware` 改造：驗證 JWT 後提取 tenant context

### 3. 定價模型設計 (NT$ 計價)

| 方案 | 月費 | 包含 Agent | 每日呼叫上限 | 目標客群 |
|------|------|-----------|-------------|---------|
| **入門版** | NT$990 | 3 Agent（Accountant, Lex, Finance） | 100/day | 個人/自雇者 |
| **專業版** | NT$2,990 | 全 12 Agent | 500/day | 小型營建公司 |
| **企業版** | NT$7,990 | 全 Agent + SLA | 無限 | 中型營建公司 |
| **自建版** | NT$14,990 | 全 Agent + 專屬 Ollama | 無限 + 優先 | 大型公司 |

#### 計費架構

```
Request → Rate Limiter → Agent Route → Billing Counter
                                         ↓
                                    Firestore: tenants/{tid}/billing/
                                      ├─ daily_usage
                                      ├─ monthly_usage
                                      └─ overage_charges

Stripe Billing (月底扣款):
  ├─ 基礎月費（固定）
  └─ 超額費用（每超額 100 次 = NT$99）
```

### 4. 資源公平性：Per-Tenant Rate Limiting

```typescript
// 現有 rate limiter 改造：加入 tenant 維度
const tenantLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,  // 24 小時
  max: (req) => {
    const plan = req.tenantPlan;
    switch (plan) {
      case 'starter':      return 100;
      case 'professional': return 500;
      case 'enterprise':   return Infinity;
      default:             return 50;  // free trial
    }
  },
  keyGenerator: (req) => req.tenantId,
  message: { error: '每日 Agent 呼叫次數已達上限' },
});
```

### 5. 遷移路徑

```
Phase 1 (v8.5 — Q4 2026): MVP SaaS
  ├─ Collection Prefix 隔離
  ├─ Tenant Middleware
  ├─ Per-tenant rate limiting
  ├─ Stripe Billing 基礎整合
  └─ 自有帳號（senteng）遷移為第一個租戶

Phase 2 (v9.0 — Q1 2027): 成長
  ├─ Onboarding 自助化
  ├─ 管理員面板（Dashboard 改造）
  ├─ 計費報表
  └─ Audit Log per-tenant

Phase 3 (v9.5 — Q2 2027): 企業版
  ├─ 獨立 Firestore Project（選配）
  ├─ 專屬 Ollama 實例
  ├─ SSO / SAML 整合
  └─ SLA 保證
```

## Consequences

### 正面
- 低成本啟動（Phase 1 無額外基礎設施費用）
- 漸進式遷移（先服務自己，再向外開放）
- Collection Prefix 對現有 Store 的修改量最小

### 負面
- Collection Prefix 非物理隔離（共享 Firestore quota）
- 需要嚴格的 Code Review 確保所有 Store 查詢都帶 tenant prefix
- 未來 Phase 3 遷移至獨立 Project 時需要大規模資料搬遷

### 風險
- Firestore 的 per-document 操作在高租戶密度下可能觸及 quota
- 單一 Ollama 實例難以服務多租戶的推理需求（需要排隊機制）

## 相關決策
- ADR-08: MCP Server（scope 設計復用於 tenant 權限）
- ADR-09: A2A Protocol（跨租戶 Agent 通訊需要 A2A）
- D-1: E2E 測試框架（需新增 multi-tenant 測試場景）
