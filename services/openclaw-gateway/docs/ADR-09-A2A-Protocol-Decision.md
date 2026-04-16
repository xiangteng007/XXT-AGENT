# ADR-09: Agent-to-Agent (A2A) Protocol 採用決策

|          |                              |
|----------|------------------------------|
| **Status**   | Proposed                 |
| **Date**     | 2026-04-16               |
| **Author**   | Opus 4.6 (System Architect) |
| **Deciders** | XXT-AGENT Core Team      |
| **Tags**     | N-4, A2A, Architecture   |

---

## Context

XXT-AGENT 現有的跨 Agent 協作機制為 **Write Request Queue (WRQ)**，實作 **QVP 協議**（質詢驗證協議）。Google 在 2025 年推出的 **Agent-to-Agent (A2A) Protocol** 提供了一個開放標準，用於不同系統的 Agent 之間的通訊。本 ADR 評估是否應將現有 WRQ 遷移至 A2A。

## Analysis

### 1. 能力對比矩陣

| 維度 | Write Request Queue (QVP) | Google A2A Protocol |
|------|--------------------------|---------------------|
| **部署模型** | In-process singleton | HTTP-based agent cards |
| **冪等性** | ✅ 雙層（記憶體 + Firestore） | ✅ 內建 task ID |
| **重試策略** | ✅ 指數退避 + dead letter | 由 runtime/framework 管理 |
| **跨系統** | ❌ 僅 Gateway 內部 | ✅ 可跨不同 host/domain |
| **發現機制** | 硬編碼端點映射 (`AGENT_WRITE_ENDPOINTS`) | Agent Card (`/.well-known/agent.json`) |
| **長時任務** | ❌ 同步投遞（5s timeout） | ✅ Streaming + SSE push |
| **雙向通訊** | ❌ 單向投遞（fire & forget） | ✅ Bi-directional artifacts |
| **多模態** | ❌ JSON only | ✅ MediaPart (audio, image, file) |
| **認證** | API Key（內部） | OAuth 2.0 / API Key |
| **成熟度** | Production-ready（~500 行） | Early adoption（SDK 演進中） |
| **程式碼量** | ~500 行 TypeScript | SDK + Agent Card + 路由改造 |

### 2. WRQ 的優勢（現狀分析）

WRQ 在 XXT-AGENT 的單容器架構下運作良好：

```typescript
// 現有架構：所有 Agent 同一容器、同一 process
const AGENT_WRITE_ENDPOINTS: Record<string, string> = {
  accountant: '/agents/accountant/ledger',
  guardian:   '/agents/guardian/policy',
  lex:        '/agents/lex/contract',
  zora:       '/agents/zora/donation',
  scout:      '/agents/scout/mission',
};
```

- 冪等性雙層防護（記憶體 Set + Firestore `write_request_log`）
- 指數退避 + 隨機抖動（避免雷群效應）
- Dead Letter 集合 + Telegram 告警
- 簡單直接，維護成本低

### 3. A2A 的潛在價值

A2A 的核心價值在 **跨系統** Agent 通訊：

```
┌─────────────────┐         A2A         ┌─────────────────┐
│ XXT-AGENT        │ ◄─────────────────► │ 外部 SaaS Agent  │
│ (Scout/Lex/...)  │   Agent Card        │ (ERP/CRM/...)   │
└─────────────────┘   Discovery          └─────────────────┘
```

在以下場景中，A2A 明顯優於 WRQ：
- **E-5 SaaS 化**：多租戶的 Agent 需要跨 project 通訊
- **外部整合**：與客戶的 ERP/CRM 系統的 Agent 互動
- **Market Connect**：Sage Agent 向外部數據供應商查詢資料

### 4. PoC 設計：Scout → Lex 協作

#### A2A 實作版本

```
1. Scout Agent Card (/.well-known/agent.json):
   {
     "name": "XXT Scout Agent",
     "description": "UAV 任務管理與現場勘察",
     "url": "https://gateway.xxt-agent.com/a2a/scout",
     "capabilities": {
       "streaming": true,
       "pushNotifications": true
     },
     "skills": [
       {
         "id": "create_contract_request",
         "name": "UAV 合約請求",
         "description": "完成 UAV 任務後，向 Lex 發起合約建立請求"
       }
     ]
   }

2. Task Flow:
   Scout → POST /a2a/lex/tasks/send
     → Lex 建立合約 draft
     → Lex 回傳 artifact (合約 PDF)
     → Scout 確認完成
```

#### QVP 實作（現有）

```
1. Scout Route → writeRequestQueue.submit({
     source_agent: 'scout',
     target_agent: 'lex',
     collection: 'contracts',
     operation: 'create',
     data: { title: 'UAV 合約', ... },
     idempotency_key: 'scout-lex-contract-{mission_id}',
   })

2. WRQ → POST /agents/lex/contract (internal HTTP)
   → Lex 處理寫入
   → 成功 → DELIVERED | 失敗 → RETRY → DEAD_LETTER
```

### 5. 遷移成本估算

| 工作項目 | 預估工時 | 風險等級 |
|---------|---------|---------|
| A2A SDK 整合 + Agent Card 伺服 | 2 天 | 低 |
| WRQ → A2A Task 轉換層 | 3 天 | 中 |
| 認證改造（OAuth 2.0 scope） | 2 天 | 中 |
| 5 個 Agent 的 Agent Card 定義 | 1 天 | 低 |
| 雙向通訊改造（bi-directional） | 3 天 | 高 |
| 測試與回歸驗證 | 2 天 | 中 |
| **合計** | **~13 天** | — |

## Decision

### **短期保留 WRQ，長期規劃 A2A 遷移**

```
     現在 (2026 Q2)          Q3              Q4 (E-5 SaaS)
     ━━━━━━━━━━━━━━━    ━━━━━━━━━━━━━    ━━━━━━━━━━━━━━━━━━
     WRQ (production)    A2A PoC         A2A 正式遷移
     │                   (Scout→Lex)     ├─ Agent Cards
     │                                   ├─ Task Manager
     │                                   └─ 外部整合 ready
     ▼
     保持運作
```

**決策理由**：

1. **WRQ 已滿足當前需求**：9 個 Agent 的內部協作穩定運行
2. **A2A 的核心價值在跨系統**：目前 XXT-AGENT 是單租戶、單容器
3. **E-5 SaaS 化時再正式遷移**：多租戶需求確認後，A2A 的價值才能發揮
4. **PoC 先行驗證**：Sprint 6-7 用 Scout→Lex 驗證 A2A SDK 穩定性

### 建議的遷移策略

```typescript
// Phase 1: Adapter Pattern（不影響現有 WRQ 行為）
interface AgentCommunicator {
  send(request: CollaborationRequest): Promise<CollaborationResult>;
}

class WRQCommunicator implements AgentCommunicator {
  // 現有 WRQ 實作
}

class A2ACommunicator implements AgentCommunicator {
  // A2A SDK 實作
}

// Feature flag 控制切換
const communicator = process.env.USE_A2A === 'true'
  ? new A2ACommunicator()
  : new WRQCommunicator();
```

## Consequences

### 正面
- 不打斷現有穩定運行的系統
- PoC 提前驗證 A2A SDK 成熟度
- Adapter Pattern 確保遷移時零停機

### 負面
- 短期內維護兩套通訊機制的認知負擔
- A2A spec 可能在 PoC 期間有 breaking changes

### 風險
- Google A2A 生態如果成長緩慢，遷移的投資回報可能不足
- WRQ 的 in-process 容錯設計在 A2A 外部化後可能降級

## 相關決策
- ADR-08: MCP Server 整合架構（MCP 的 scope 設計可復用於 A2A 認證）
- C-1a~d: 跨 Agent 協作實作（WRQ 的使用場景）
- E-5: SaaS 化（A2A 正式遷移的觸發條件）
