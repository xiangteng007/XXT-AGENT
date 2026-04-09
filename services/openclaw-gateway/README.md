# OpenClaw Gateway

> **XXT-AGENT v7 — 集中化 AI 推理閘道器**
>
> 多 Agent 協調中樞，負責路由所有 Token 請求、管理推理隱私分層、
> 提供 WebSocket 即時通訊，並整合台灣建築法規 RAG 查詢。

---

## 目錄

- [架構概覽](#架構概覽)
- [快速啟動](#快速啟動)
- [環境變數](#環境變數)
- [API 路由一覽](#api-路由一覽)
- [Agent 系統](#agent-系統)
- [推理隱私分層 (NemoClaw v2)](#推理隱私分層-nemoclaw-v2)
- [測試](#測試)
- [CI/CD](#cicd)
- [架構決策](#架構決策)

---

## 架構概覽

```
┌─────────────────────────────────────────────────────────┐
│                  OpenClaw Gateway                        │
│  (Express + TypeScript | Cloud Run | port 3100)          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Firebase JWT Auth  ← 所有受保護路由的守衛        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  推理 Fallback Chain:                                    │
│  Gemini 2.0 Flash → Gemini 1.5 Flash → Ollama (本地)    │
│                                                          │
│  資料持久化：                                            │
│  Firestore (entities) + AES-256-GCM (encrypted fields)  │
└─────────────────────────────────────────────────────────┘
         ↑                         ↕
  Dashboard / Telegram       NAS Ollama (RTX 4080)
  (Firebase Auth)            qwen3:14b / qwen3-coder
```

### 核心模組

| 模組 | 檔案 | 職責 |
|------|------|------|
| Express App | `src/app.ts` | 路由掛載、中間件配置（可獨立測試） |
| HTTP Server | `src/index.ts` | 啟動伺服器、WebSocket、Graceful Shutdown |
| 推理包裝器 | `src/inference-wrapper.ts` | Gemini → Ollama Fallback Chain |
| Ollama 推理 | `src/ollama-inference.service.ts` | 本地模型調用（自動注入 `/no_think`） |
| 隱私路由器 | `src/privacy-router.ts` | PRIVATE/INTERNAL/PUBLIC 分層 |
| 泛型存儲 | `src/base-entity-store.ts` | AES-256-GCM 加密的 Firestore CRUD |
| 速率限制 | `src/middleware/rate-limiter.ts` | 全局 / Agent / 財務三層限制 |
| 法規 RAG | `src/routes/regulation.ts` | 台灣建築/稅務/航空法規查詢 |

---

## 快速啟動

### 前置要求

- Node.js 20+
- Firebase 專案（含 Firestore）
- Ollama（本地 NAS 或 localhost:11434）

### 本地開發

```bash
cd services/openclaw-gateway

# 安裝依賴
npm install

# 設定環境變數
cp .env.example .env
# 填入 FIREBASE_PROJECT_ID 等必要值

# 啟動開發伺服器
npm run dev
# → http://localhost:3100
```

### 快速驗證

```bash
# Gateway 健康狀態
curl http://localhost:3100/health

# Titan (BIM) Agent 狀態
curl -H "Authorization: Bearer <token>" http://localhost:3100/agents/bim/health
```

---

## 環境變數

```bash
# ── 基礎 ──────────────────────────────────────────────────────
PORT=3100
DEPLOY_MODE=local            # local | production
NODE_ENV=development

# ── 認證（開發用）────────────────────────────────────────────
DEV_BYPASS_AUTH=true         # ⚠️ 生產環境禁用（雙重保護：production 強制 false）
FIREBASE_PROJECT_ID=xxt-agent-dev

# ── 本地 Ollama 模型 ──────────────────────────────────────────
LOCAL_RUNNER_BASE_URL=http://localhost:11434
OLLAMA_L1_MODEL=qwen3:14b
OLLAMA_CODER_MODEL=qwen3-coder:30b-a3b
OLLAMA_KEEP_ALIVE=5m
OLLAMA_TIMEOUT_MS=30000

# ── CORS 白名單（逗號分隔）────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-dashboard.vercel.app

# ── 資料加密（Firestore 敏感欄位 AES-256-GCM）────────────────
STORE_ENCRYPTION_KEY=64位16進位字串  # openssl rand -hex 32

# ── NemoClaw 隱私設定 ─────────────────────────────────────────
PRIVACY_ENFORCE_LOCAL=false  # true = 所有請求強制本地推理
PRIVACY_LOG_REDACTED_PROMPTS=false

# ── 台灣法規 RAG ──────────────────────────────────────────────
REGULATION_RAG_URL=http://localhost:8092  # P2: 本地 Qdrant RAG service

# ── WebSocket ─────────────────────────────────────────────────
WS_HEARTBEAT_MS=25000
```

---

## API 路由一覽

### 公開路由（無需認證）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/health` | Gateway 整體健康狀態（WS 連線數、Context Store、Rate Limit 統計） |
| GET | `/vram/*` | VRAM 使用率（本地 GPU 監控） |
| GET | `/system/*` | 系統路由（僅本地可存取） |

### 保護路由（需 Firebase JWT）

#### 系統 & 事件

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/events` | 事件注入（NEWS_INGESTED, TASK_QUEUED 等） |
| GET | `/agents/state` | 所有 Agent 聚合狀態快照 |
| GET | `/audit/*` | 推理稽核記錄 |

#### 台灣法規 RAG

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/regulation/categories` | 11 個法規分類清單 |
| GET | `/regulation/sources` | 支援的法律文件來源 |
| POST | `/regulation/query` | RAG 查詢（支援 `category` 過濾） |
| POST | `/regulation/ask` | AI 法規問答（RAG + Ollama 推理） |

**支援的 11 個法規類別：**
`tax` `labor` `building` `fire` `cns` `insurance` `aviation` `nonprofit` `renovation` `ip_creative` `real_estate`

---

## Agent 系統

每個 Agent 擁有獨立的路由模組掛載於 `/agents/{agent-id}/`，遵循統一的健康端點協議。

### Division 5 — 財務層（強制本地推理 + 財務速率限制）

#### 🦦 Kay (Accountant) — `/agents/accountant/`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/chat` | 自由問答（稅務/帳務，RAG 支援） |
| POST | `/ledger` | 新增收支記錄（含實體分類） |
| GET | `/ledger` | 查詢收支明細 |
| GET | `/report/summary` | 期間彙總（當前 VAT 期） |
| GET | `/report/401` | 營業稅 401 申報格式 |
| GET | `/report/annual` | 年度收支彙總 |
| GET | `/export/csv` | 收支明細 CSV 匯出（含 BOM） |
| POST | `/bank/account` | 新增銀行帳戶 |
| GET | `/bank/accounts` | 查詢帳戶列表 |
| POST | `/bank/txn` | 記錄銀行往來（雙寫至帳本） |
| GET | `/bank/balance` | 各帳戶餘額彙總 |
| POST | `/taxplan` | AI 節稅規劃（RAG + 年度帳本分析） |
| GET | `/health` | Agent 狀態 |

### Division 6 — 工程空間設計層

#### 🤖 Titan (BIM) — `/agents/bim/`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/chat` | BIM 問答 |
| POST | `/model` | 新增 BIM 模型記錄 |
| GET | `/model` | 查詢 BIM 模型清單 |
| POST | `/collision` | 碰撞檢測（回傳建議通知 Rusty） |
| GET | `/health` | Agent 狀態 |

#### 🪄 Lumi (Interior) — `/agents/interior/`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/chat` | 室內設計問答 |
| POST | `/project` | 新增裝修專案 |
| GET | `/project` | 查詢專案清單 |
| POST | `/material` | AI 材料推薦（風格分析） |
| GET | `/health` | Agent 狀態 |

#### 🦊 Rusty (Estimator) — `/agents/estimator/`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/chat` | 算量/估價問答（CNS RAG 支援） |
| POST | `/bom` | 新增材料清單（BOM） |
| GET | `/bom` | 查詢 BOM 清單 |
| POST | `/quote` | 工程概估報價（台灣 2024 工種費率） |
| GET | `/health` | Agent 狀態 |

### Division 7 — 業務營運層 v2.0

#### 🚁 Scout (UAV) — `/agents/scout/`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/chat` | 無人機問答（合規/法規） |
| POST | `/pilot` | 新增飛手資料 |
| GET | `/pilot` | 查詢飛手清單（含執照狀態） |
| POST | `/mission` | 新增飛行任務（自動合規警示） |
| GET | `/mission` | 查詢任務清單 |
| PATCH | `/mission/:id/status` | 更新任務狀態 |
| POST | `/permit/check` | 飛行許可確認（依地點） |
| GET | `/report/monthly` | 月度任務彙總 |
| GET | `/health` | Agent 狀態 |

#### 🌟 Zora (NGO) — `/agents/zora/`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/chat` | NGO 法規/業務問答 |
| POST | `/donation` | 新增捐款記錄（含稅務提醒） |
| GET | `/donation` | 查詢捐款清單 |
| GET | `/donation/:id/receipt` | 產生捐款收據（含申報說明） |
| PATCH | `/volunteer/:id/service` | 更新志工服務記錄 |
| POST | `/mission` | 新增救援任務 |
| GET | `/report/finance` | 基金會財務報表 |
| GET | `/health` | Agent 狀態 |

#### ⚖️ Lex (Legal) — `/agents/lex/`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/chat` | 合約法律問答（多類別 RAG） |
| POST | `/contract` | 新增合約（含自動付款里程碑） |
| GET | `/contract` | 查詢合約清單 |
| GET | `/contract/expiring` | 即將到期合約警示 |
| GET | `/contract/milestones` | 所有進行中合約未付款節點 |
| PATCH | `/contract/:id/status` | 更新合約狀態（標記里程碑自動通知 Kay） |
| POST | `/contract/:id/analyze` | AI 條款風險分析 |
| POST | `/document` | 新增文件（DocHub） |
| GET | `/document/expiring` | 即將到期文件（執照/保單） |
| GET | `/health` | Agent 狀態 |

---

## 推理隱私分層 (NemoClaw v2)

```
Privacy Level  → 推理路由
─────────────────────────────────────────────────────────
PUBLIC         → Gemini 2.0 Flash → Gemini 1.5 Flash → Ollama
INTERNAL       → Ollama (qwen3:14b 本地) → 失敗即報錯
PRIVATE        → Ollama 強制（財務資料不出境）
```

所有財務 Agent（Kay, Guardian, Finance）強制 PRIVATE 等級 — 資料不上雲端。

---

## 測試

```bash
# 執行全套整合測試（不需 Ollama）
npm test

# 執行 agent 路由整合測試
npx vitest run agent-routes.integration

# 執行核心路由整合測試
npx vitest run routes.integration

# CI 模式（跳過 AI 推理測試）
SKIP_AI_TESTS=true npm test
```

### 測試覆蓋現狀

| 測試檔案 | 測試數 | 通過數 | 說明 |
|----------|--------|--------|------|
| `routes.integration.test.ts` | ~75 | ~75 | 核心路由、認證、事件、法規 |
| `agent-routes.integration.test.ts` | 81 | 77+ | 9 Agent CRUD + 路由回歸 |

> 4 個測試在無 Ollama 的 CI 環境跳過（AI 推理依賴），可透過
> `SKIP_AI_TESTS=true` 明確標記。

---

## CI/CD

### 工作流程

```
push / PR → GitHub Actions
  ├─ deploy-gateway.yml
  │   ├─ 1. npm test (整合測試防護網)
  │   ├─ 2. Docker Build + Trivy 漏洞掃描
  │   ├─ 3. Push to Artifact Registry
  │   ├─ 4. Deploy to Cloud Run (Staging)
  │   ├─ 5. Smoke Test (health + agent/state)
  │   └─ 6. 若通過 → 推進 Production
  └─ dashboard-ci.yml
      └─ Lighthouse CI (Performance / A11y 基準)
```

### Cloud Run 設定

```yaml
# gcloud run deploy openclaw-gateway \
#   --image [REGION]-docker.pkg.dev/[PROJECT]/[REPO]/openclaw-gateway:latest \
#   --region asia-east1 \
#   --set-env-vars DEPLOY_MODE=production \
#   --set-env-vars CORS_ALLOWED_ORIGINS=https://your-dashboard.vercel.app \
#   --set-secrets FIREBASE_SERVICE_ACCOUNT_JSON=firebase-sa:latest \
#   --set-secrets STORE_ENCRYPTION_KEY=store-encryption-key:latest
```

---

## 架構決策

### ADR-01: app.ts / index.ts 分離 (A-01)

**動機**：讓 Integration Test 可以在不啟動 HTTP Server 的情況下測試路由邏輯。

```
index.ts → 負責 HTTP Server + WebSocket + Graceful Shutdown
app.ts   → 負責 Express App 設定 + 路由掛載（可被 Supertest 直接 import）
```

### ADR-02: Inference Fallback Chain (AI-02)

```typescript
// inference-wrapper.ts
// Cloud: Gemini 2.0 Flash → Gemini 1.5 Flash
// Local: Ollama (qwen3:14b)
// 自動選擇 + 錯誤降級
```

### ADR-03: DEV_BYPASS_AUTH 雙重保護 (S-02)

生產環境（`DEPLOY_MODE=production`）強制忽略 `DEV_BYPASS_AUTH`，
防止開發時的 bypass flag 意外漏到生產環境。

### ADR-04: Prompt 版本管理 (AI-04)

所有 Agent 的系統提示詞集中在 `src/prompts/registry/`，
每個 prompt 包含版本號、語言、隱私等級等元資料。

### ADR-05: BaseEntityStore 泛型加密存儲 (A-02)

```typescript
// base-entity-store.ts
// AES-256-GCM 加密敏感欄位（銀行帳號、身分資訊）
// 所有 Agent 的 Firestore CRUD 共用此基礎類別
createEntityStore<T>({ collection, encryptedFields, ... })
```

### ADR-06: vitest isolate:true (T-01)

多個 integration test 文件之間需要模組隔離，
防止 Express app 實例共用造成狀態污染。

---

## 目錄結構

```
services/openclaw-gateway/
├── src/
│   ├── app.ts                    # Express App（路由掛載）
│   ├── index.ts                  # HTTP Server + WebSocket
│   ├── inference-wrapper.ts      # AI 推理 Fallback Chain
│   ├── ollama-inference.service.ts
│   ├── privacy-router.ts         # 隱私分層配置
│   ├── base-entity-store.ts      # AES-256 加密泛型存儲
│   ├── context-store.ts          # 對話上下文 (Redis/in-memory)
│   ├── ledger-store.ts           # 會計分類帳
│   ├── bank-store.ts             # 銀行帳戶/往來
│   ├── write-request-queue.ts    # Agent 間寫請求佇列（冪等）
│   ├── prompts/
│   │   └── registry/             # AI-04: 版本化 Prompt 管理
│   ├── routes/
│   │   ├── accountant.ts         # Kay (Accountant) 917 行
│   │   ├── bim.ts                # Titan (BIM)
│   │   ├── interior.ts           # Lumi (Interior Design)
│   │   ├── estimator.ts          # Rusty (Quantity Surveyor)
│   │   ├── scout.ts              # Scout (UAV Operations)
│   │   ├── zora.ts               # Zora (NGO)
│   │   ├── lex.ts                # Lex (Legal/Contract)
│   │   ├── guardian.ts           # Guardian (Insurance)
│   │   ├── finance.ts            # Finance (Investment)
│   │   ├── regulation.ts         # 台灣法規 RAG（11 類別）
│   │   └── ...
│   ├── middleware/
│   │   ├── firebase-auth.ts      # JWT 驗證 + DEV_BYPASS 雙保護
│   │   ├── rate-limiter.ts       # 全局/Agent/財務三層速率限制
│   │   └── error-handler.ts      # 全局錯誤處理
│   ├── routes.integration.test.ts
│   └── agent-routes.integration.test.ts
├── .env.example
├── Dockerfile
├── vitest.config.ts              # isolate:true + testTimeout:30s
└── package.json
```

---

## 版本歷程

| 版本 | 日期 | 重點 |
|------|------|------|
| v7.5 | 2026-04 | 全系統整合測試 (T-01)、vitest 隔離修復、B-03 /no_think 去重 |
| v7.0 | 2026-04 | Division 6/7 加入（BIM/Interior/Scout/Zora/Lex）、Prompt 版本化 |
| v6.5 | 2026-03 | Kay Accountant + Ledger Store + 401 報表 |
| v6.0 | 2026-03 | NemoClaw v2 隱私分層、BaseEntityStore 加密 |
| v5.0 | 2026-02 | OpenClaw Gateway 初版（Cloud Run 部署） |
