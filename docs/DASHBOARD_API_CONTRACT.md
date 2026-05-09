# Dashboard API Contract

> 5 個靜態 Mock 頁面的 API 接入規劃  
> **實作狀態**: ✅ 5/5 全部完成

## 頁面 → API 對照

### 1. Infrastructure (P1) — ✅ 已接入

- Service Health → `GET /api/system/status`
- Ollama → `GET {OLLAMA}/api/tags` + `/api/ps`
- GPU VRAM → `GET {OLLAMA}/api/ps` → `size_vram`
- **API Route**: `app/api/system/status/route.ts`
- **刷新**: 30 秒

### 2. Financial (P1) — ✅ 已接入（含 Fallback）

- Budget → `GET /agents/accountant/report/summary`
- Ledger → `GET /agents/accountant/ledger`
- Tax → `<TaxPlanner />` 元件
- **API Route**: `app/api/system/financial/route.ts`
- **刷新**: 60 秒 / 離線自動切換 Mock

### 3. Observability (P3) — ✅ 已接入

- Gateway Health → `GET {GATEWAY}/health`
- Agent Health × 8 → `GET {GATEWAY}/agents/{slug}/health`
- Latency Metrics → 自動計算
- **API Route**: `app/api/system/observability/route.ts`
- **刷新**: 15 秒

### 4. Matrix (P2) — ✅ 已接入（含 Fallback）

- Agent State → `GET /api/agents/state` → proxy `/agents/state`
- Thread → Showcase 靜態（待 WebSocket）
- **API Route**: `app/api/agents/state/route.ts`
- **刷新**: 10 秒

### 5. War Room (P2) — ✅ 已接入

- Agent Roster → `GET /api/agents/state` (10s 刷新, fallback to AGENTS_DATA)
- Investment / Banking / Material → 既有元件 (InvestmentWidget, BankingWidget etc.)
- WebSocket → `WarRoomWebSocket` 元件
- **版本**: v2.5.0 顯示 + LIVE 標籤

## API Routes 結構

```
apps/dashboard/src/app/api/
├── agents/
│   └── state/route.ts          # ✅ Agent 狀態代理
├── market/
│   └── _gateway.ts             # 共用 Gateway 代理
├── system/
│   ├── status/route.ts         # ✅ Infrastructure
│   ├── financial/route.ts      # ✅ Financial
│   └── observability/route.ts  # ✅ Observability
├── butler/                     
├── chat/                       
├── news/                       
└── telegram/                   
```
