# ADR-08: Model Context Protocol (MCP) Server 整合架構

|          |                              |
|----------|------------------------------|
| **Status**   | Proposed                 |
| **Date**     | 2026-04-16               |
| **Author**   | Opus 4.6 (System Architect) |
| **Deciders** | XXT-AGENT Core Team      |
| **Tags**     | E-4, MCP, Architecture   |

---

## Context

XXT-AGENT v8.0 擁有 12 個專業 Agent（Accountant, Guardian, Finance, Scout, Zora, Lex, Nova, Titan, Lumi, Rusty, Invest, Sage），每個 Agent 都有豐富的領域能力。目前這些能力僅能透過：

1. **Web Dashboard** (`apps/office`) — 前端 UI 操作
2. **Telegram Bot** (`@SENTENGMAIN_BOT`) — 指令式互動
3. **REST API** — 直接呼叫 Gateway 端點

但隨著 **AI IDE**（Cursor, Windsurf, VSCode Copilot）和 **AI 平台**（Claude Desktop, ChatGPT, Gemini）廣泛採用 **Model Context Protocol (MCP)**，我們需要一個標準化的方式讓外部 AI 工具可以呼叫 XXT-AGENT 的能力。

## Decision

### 1. MCP Spec 版本：選定 **MCP v2.0** (2025 Draft → 2026 Stable)

**理由**：

| 能力 | v1.0 | v2.0 | 決策影響 |
|------|------|------|---------|
| 認證 | ❌ 無 | ✅ OAuth 2.1 + PKCE | PRIVATE Agent 必須有認證 |
| 傳輸 | stdio / HTTP+SSE | stdio / **Streamable HTTP** | 減少 SSE 連線維護成本 |
| 工具安全 | 基本 | ✅ scoped permissions | 符合 QVP 隱私等級設計 |
| SDK | `@modelcontextprotocol/sdk@0.x` | `@modelcontextprotocol/sdk@1.x` | 穩定 API |
| annotations | ❌ | ✅ Tool annotations | 可標註 privacy_level |

v2.0 的 OAuth 2.1 認證和 scoped permissions 是選定它的關鍵因素，因為 XXT-AGENT 有三級隱私等級（PUBLIC / INTERNAL / PRIVATE）。

### 2. 部署拓撲：Gateway Sidecar 模式

```
                    ┌──────────────────────────────┐
                    │     Cloud Run Container       │
                    │                               │
 MCP Client ──────►│  MCP Server (:3101)           │
 (Cursor/Claude)    │    │                          │
                    │    ├─ OAuth 2.1 驗證           │
                    │    ├─ Scope 檢查               │
                    │    ├─ Rate Limiter             │
                    │    │                          │
                    │    └──► Gateway (:3100)        │
                    │         ├─ Firebase Auth       │
                    │         ├─ Agent Routes        │
                    │         └─ WRQ / Firestore     │
                    └──────────────────────────────┘
```

- MCP Server 作為 Gateway 的 **sidecar** 部署於同一容器
- 共享 `localhost` 網路，MCP → Gateway 呼叫無需外部認證
- MCP 對外暴露 `:3101`，Gateway 維持 `:3100`

### 3. MCP Tool Schema

#### 3.1 `xxt.ledger.query` — 帳本查詢

```json
{
  "name": "xxt.ledger.query",
  "description": "查詢 XXT-AGENT 帳本記錄。可依期間、類型、法人實體篩選。回傳帳本明細含金額、稅務資訊、對手方。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "period": {
        "type": "string",
        "pattern": "^\\d{6}$",
        "description": "查詢期間（YYYYMM 格式，如 202604）"
      },
      "type": {
        "type": "string",
        "enum": ["income", "expense"],
        "description": "收入或支出"
      },
      "entity_type": {
        "type": "string",
        "description": "法人實體識別碼（如 co_senteng, personal）"
      },
      "limit": {
        "type": "integer",
        "default": 50,
        "maximum": 200,
        "description": "回傳筆數上限"
      }
    }
  },
  "annotations": {
    "title": "帳本查詢",
    "readOnlyHint": true,
    "destructiveHint": false,
    "openWorldHint": false
  }
}
```

**隱私等級**: `PRIVATE` — 需要 `ledger:read` scope

#### 3.2 `xxt.contract.analyze` — 合約風險分析

```json
{
  "name": "xxt.contract.analyze",
  "description": "分析合約條款風險，包含違約金、保固期、責任上限等法律要素。需提供合約 ID 或合約文字內容。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "contract_id": {
        "type": "string",
        "description": "已存在的合約 ID（從 Lex Agent 查詢）"
      },
      "contract_text": {
        "type": "string",
        "maxLength": 50000,
        "description": "合約文字內容（與 contract_id 擇一使用）"
      },
      "analysis_focus": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["penalty", "warranty", "liability", "payment_terms", "termination", "all"]
        },
        "default": ["all"],
        "description": "分析重點領域"
      }
    },
    "oneOf": [
      { "required": ["contract_id"] },
      { "required": ["contract_text"] }
    ]
  },
  "annotations": {
    "title": "合約風險分析",
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true
  }
}
```

**隱私等級**: `PRIVATE` — 需要 `contract:analyze` scope

#### 3.3 `xxt.reconcile.run` — 執行對帳

```json
{
  "name": "xxt.reconcile.run",
  "description": "執行 Accountant ↔ Finance 自動對帳，比對帳本支出與貸款月繳記錄。回傳差異報告與建議行動。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "period": {
        "type": "string",
        "pattern": "^\\d{6}$",
        "description": "對帳期間（YYYYMM 格式）"
      },
      "entity_type": {
        "type": "string",
        "description": "法人實體篩選"
      },
      "persist": {
        "type": "boolean",
        "default": false,
        "description": "是否將對帳結果持久化至 Firestore"
      }
    }
  },
  "annotations": {
    "title": "自動對帳",
    "readOnlyHint": false,
    "destructiveHint": false,
    "idempotentHint": true
  }
}
```

**隱私等級**: `INTERNAL` — 需要 `system:reconcile` scope

#### 3.4 `xxt.agent.chat` — 通用 Agent 對話

```json
{
  "name": "xxt.agent.chat",
  "description": "與 XXT-AGENT 系統進行對話。系統會自動路由至適合的 Agent 回答（Accountant, Guardian, Lex 等）。支援繁體中文。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "minLength": 1,
        "maxLength": 5000,
        "description": "使用者訊息（建議使用繁體中文）"
      },
      "target_agent": {
        "type": "string",
        "enum": ["accountant", "guardian", "finance", "scout", "zora", "lex", "nova", "titan", "lumi", "rusty"],
        "description": "指定回答的 Agent（可選，未指定則自動路由）"
      },
      "session_id": {
        "type": "string",
        "description": "會話 ID（用於多輪對話的上下文延續）"
      }
    },
    "required": ["message"]
  },
  "annotations": {
    "title": "Agent 對話",
    "readOnlyHint": false,
    "destructiveHint": false,
    "openWorldHint": true
  }
}
```

**隱私等級**: `PUBLIC` — 需要 `agent:chat` scope

### 4. Auth 橋接策略

```
MCP Client (Cursor / Claude Desktop)
  │
  │ (1) OAuth 2.1 Authorization Code + PKCE
  ▼
┌──────────────────────────┐
│ MCP Server Auth Layer     │
│                           │
│ POST /mcp/auth/authorize  │ ◄─ 發起 OAuth flow
│ POST /mcp/auth/token      │ ◄─ 交換 access_token
│ POST /mcp/auth/exchange   │ ◄─ MCP token → Firebase JWT
│                           │
│ Scopes:                   │
│  - agent:chat             │ PUBLIC tools
│  - system:reconcile       │ INTERNAL tools
│  - ledger:read            │ PRIVATE tools
│  - contract:analyze       │ PRIVATE tools
│  - admin:*                │ 全權限（僅限 owner）
└──────────────────────────┘
  │
  │ (2) Firebase Custom Token → JWT
  ▼
┌──────────────────────────┐
│ OpenClaw Gateway (:3100)  │
│ firebaseAuthMiddleware    │
│ ├─ Verify JWT             │
│ ├─ Extract scopes         │
│ └─ Rate limit             │
└──────────────────────────┘
```

**Token 交換流程**：
1. MCP Client 完成 OAuth 2.1 授權，取得 MCP access_token
2. MCP Server 驗證 access_token，提取 scopes
3. MCP Server 使用 Firebase Admin SDK 產生 Custom Token
4. Custom Token 包含 `scopes` claim，用於下游 scope 驗證
5. 所有 Tool 呼叫經 rate limiter

## Consequences

### 正面
- 任何支援 MCP 的 AI 工具都能直接使用 XXT-AGENT 能力
- OAuth 2.1 確保安全存取控制
- Tool annotations 讓 AI 理解每個工具的行為特性

### 負面
- 增加一個 sidecar 服務的維護成本
- OAuth 2.1 流程對個人使用者可能過於複雜
- 需要額外的 scope 管理介面

### 風險
- MCP v2.0 spec 仍在演進，SDK API 可能有 breaking changes
- 需要持續追蹤 `@modelcontextprotocol/sdk` 版本更新

## 相關決策
- ADR-07: 推理引擎雙層容錯（已完成）
- ADR-09: A2A Protocol 採用決策（下一個）
- ADR-10: SaaS 化架構（依賴本 ADR 的 scope 設計）
