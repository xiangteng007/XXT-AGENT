# LangGraph 整合規格 — ✅ 已實作

> **狀態**: ✅ Phase 4 完成  
> **實作語言**: TypeScript（非 Python — 與 OpenClaw Gateway 一致）

## 目標
將現有 OpenClaw Gateway 的線性 Agent routing 升級為 State Graph 結構化多 Agent 討論。

## 架構

```
使用者訊息 / Dashboard Topic Input
    ↓
┌─ State Graph Engine ──────────────┐
│  (state-graph.engine.ts)          │
│                                    │
│  Round-Robin Discussion Loop:      │
│  ┌──────┐    ┌──────┐             │
│  │ Agent │───→│ Agent │ ... (N)    │
│  │  #1   │←──│  #2   │            │
│  └──────┘    └──────┘             │
│      ↓                            │
│  ┌──────────────┐                 │
│  │ Director      │ ← 共識判定      │
│  │ (Consensus)   │                │
│  └──────────────┘                 │
│      ↓ (共識 or 上限)              │
│  ┌──────────────┐                 │
│  │ Final Summary │                │
│  └──────────────┘                 │
└───────────────────────────────────┘
    ↓
  SSE Stream / JSON Response
```

## State 定義 (TypeScript)

```typescript
interface DiscussionState {
    taskId: string;
    topic: string;
    messages: AgentMessage[];
    currentAgent: string;
    agentOutputs: Record<string, string>;
    consensus: string | null;
    iteration: number;
    maxIterations: number;
    participants: string[];
    status: 'running' | 'consensus' | 'max_rounds' | 'error';
}
```

## API 端點

| 端點 | 方法 | 說明 |
|:---|:---|:---|
| `/agents/discuss` | POST | 開始新圓桌討論（支援 SSE / JSON 回應） |
| `/agents/discuss/:taskId` | GET | 查詢討論狀態 |
| `/agents/discuss/:taskId/inject` | POST | 人類操作員注入意見 |

### POST /agents/discuss

```json
{
    "topic": "如何在銅價飆漲下維持專案利潤率？",
    "participants": ["argus", "titan", "rusty", "guardian"],
    "max_iterations": 3,
    "context": "可選的背景資料..."
}
```

### 支援 Agents

argus, titan, lumi, rusty, guardian, lex, accountant, nova, scout, zora, sage

## 實作檔案

| 檔案 | 說明 |
|:---|:---|
| `state-graph.engine.ts` | State Graph 核心引擎（輪流發言 + 共識偵測） |
| `routes/discussion.ts` | REST + SSE 端點 |
| `app.ts` | 路由掛載 `/agents/discuss` |

## 與 OpenClaw 整合

- 現有 `/agents/{name}/chat` 路由保持不變
- 現有 `/deliberation/*` 保持不變（單一議題，手動操作）
- LangGraph 為新的「自動化圓桌討論」模式
- 共享 context-store 三層架構（Memory → Redis → Firestore）

## Dashboard 整合

- Matrix 頁面新增討論輸入框
- 支援即時顯示每位 Agent 發言
- 共識結論以綠色高亮顯示
- Dashboard API: `POST /api/agents/discuss`
