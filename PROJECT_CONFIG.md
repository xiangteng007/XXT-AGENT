# XXT-AGENT Platform - Project Configuration

> **最後更新**: 2026-05-05

---

## 專案概覽

**XXT-AGENT** 是一個 AI 智能投資分析平台，整合 Triple Fusion Engine（市場數據 × 新聞分析 × 社群情緒），提供個人管家（Personal Butler）生活管理系統。

---

## GitHub Repository

| 項目 | 資訊 |
|------|------|
| **主倉庫 (Monorepo)** | [xiangteng007/XXT-AGENT](https://github.com/xiangteng007/XXT-AGENT) |
| **主分支** | `main` |
| **套件管理** | pnpm 9+ (Turborepo monorepo) |
| **可見性** | Public |

---

## GCP Project

| 欄位 | 值 |
|------|-----|
| **專案名稱** | XXT-AGENT |
| **專案 ID** | xxt-agent |
| **專案編號** | 257379536720 |
| **區域** | asia-east1 (Taiwan) |

---

## Deployed Services

### Frontend (Vercel)

| 項目 | 資訊 |
|------|------|
| **平台** | Vercel |
| **專案名稱** | xxt-agent-dashboard |
| **URL** | [https://xxt-agent-dashboard.vercel.app](https://xxt-agent-dashboard.vercel.app) |
| **Source** | `apps/dashboard` |
| **狀態** | ✅ Active |

### Backend (Google Cloud)

| Service | 平台 | Source | 狀態 |
|---------|------|--------|------|
| **Cloud Functions** | Firebase Functions (Node.js 22) | `apps/functions` | ✅ Active |
| **Firestore** | Firebase | — | ✅ Active |
| **AI Gateway** | Cloud Run | `services/ai-gateway` | ✅ Active |
| **OpenClaw Gateway** | Cloud Run (v7.5) | `services/openclaw-gateway` | ✅ Active |
| **Telegram Command Bot** | Cloud Run | `services/telegram-command-bot` | ✅ Active |
| **Regulation RAG** | Cloud Run (Internal) | `services/regulation-rag` | ✅ Active |
| **Event Fusion Engine** | Cloud Run | `services/event-fusion-engine` | ✅ Active |
| **News Collector** | Cloud Run (v9.2) | `services/news-collector` | ✅ Active |
| **Market Streamer** | Cloud Run | `services/market-streamer` | ✅ Active (IAM) |
| **Quote Normalizer** | Cloud Run | `services/quote-normalizer` | ✅ Active (IAM) |
| **Alert Engine** | Cloud Run | `services/alert-engine` | ✅ Active (IAM) |
| **Trade Planner** | Cloud Run | `services/trade-planner-worker` | ✅ Active (IAM) |
| **Social Worker** | Cloud Run | `services/social-worker` | ✅ Active (IAM) |
| **Social Collector** | Cloud Run | `services/social-worker` | ✅ Active (IAM) |
| **Social Dispatcher** | Cloud Run | `services/social-dispatcher` | ✅ Active (IAM) |
| **Investment Brain** | Cloud Run / Local | `services/investment-brain` | 🟩 本地自學習上線 (v2.6) |
| **Secret Manager** | GCP | — | ✅ Active |

### Standalone Apps

| App | 平台 | Source | 狀態 |
|-----|------|--------|------|
| **World Monitor** | Standalone | `apps/worldmonitor/` | ⚠️ Excluded from workspace |
| ~~Aurelian Logic~~ | — | ~~`aurelian-logic/`~~ | ❌ 已移除 (2026-05) |

---

## URLs

- **GCP Console**: <https://console.cloud.google.com/welcome?project=xxt-agent>
- **Cloud Run**: <https://console.cloud.google.com/run?project=xxt-agent>
- **Secret Manager**: <https://console.cloud.google.com/security/secret-manager?project=xxt-agent>
- **Firestore**: <https://console.firebase.google.com/project/xxt-agent/firestore>

---

## Local Development Paths

| 組件 | 路徑 |
|------|------|
| **Dashboard (Frontend)** | `apps/dashboard/` |
| **Backend (Functions)** | `apps/functions/` |
| **AI Gateway** | `services/ai-gateway/` |
| **OpenClaw Gateway (v7.5)** | `services/openclaw-gateway/` |
| **Telegram Command Bot** | `services/telegram-command-bot/` |
| **Regulation RAG** | `services/regulation-rag/` |
| **NAS Data Plane** | `infra/nas/` |
| **Other Microservices** | `services/` |
| **Shared Types** | `packages/types/` |
| **Infrastructure (Terraform)** | `infra/terraform/` |

---

## Local Hardware Infrastructure (本地 GPU 工作站)

> **掃描日期**: 2026-03-31

| 元件 | 規格 |
|------|------|
| **CPU** | Intel Core Ultra 9 285K — 24 核心 / 24 執行緒，基礎頻率 3.7 GHz |
| **GPU** | NVIDIA GeForce RTX 4080 SUPER — 16 GB GDDR6X VRAM，Compute Capability 8.9 |
| **GPU 驅動** | 591.74 (CUDA 12.x 相容) |
| **RAM** | 64 GB DDR5-5600 (Essencore 2×32 GB, 雙通道) |
| **主儲存** | Crucial CT2000T700SSD3 — 2 TB NVMe PCIe Gen5 SSD |
| **資料磁碟** | WDC WD40EFRX-68N32N0 × 2 — 各 4 TB HDD (Storage Space 陣列約 9.3 TB) |
| **OS** | Windows 11 (64-bit) |

### 本地推理能力評估

| 模型大小 | VRAM 需求 | RTX 4080 SUPER 可行性 | 備註 |
|---------|---------|----------------------|------|
| 7B (Q4) | ~4 GB | ✅ 輕鬆 | llama.cpp / Ollama |
| 13B (Q4) | ~8 GB | ✅ 可行 | 剩餘 VRAM 供 KV Cache |
| 30B (Q4) | ~16 GB | ✅ 滿載 | 需 offload 部分層到 CPU |
| 70B (Q4) | ~35+ GB | ❌ 超出 VRAM | 需分散推理或租用雲端 |
| **Nemotron-Nano (4B)** | ~3 GB | ✅ **推薦本地首選** | NVIDIA 官方 agentic 優化 |
| **Nemotron-Super (49B)** | ~25+ GB | ⚠️ 部分 offload | 速度受限，可評估 |

### 推薦本地推理方案

```
本地 Runner (inference_route: "local"):
  ├── 優先: Nemotron-Nano (ollama pull nemotron-mini)
  ├── 備選: llama3.1:8b / qwen2.5:14b
  └── 工具: Ollama + OpenAI-Compatible API (:11434)

雲端 Runner (inference_route: "cloud"):
  ├── 主力: gemini-2.5-flash (AI Gateway)
  ├── 重量級: claude-sonnet-4.6
  └── 備用: gpt-4o-mini
```

---

## AI Model Support (2026 Q2)

| Provider | 模型 | 用途 |
|----------|------|------|
| **Google Gemini** | Gemini 3.1 Pro, 2.5 Pro/Flash, 2.0 Flash | AI Gateway enrichment, OpenClaw fallback |
| **OpenAI** | GPT-5.4, o4-mini, GPT-4o, GPT-4o-mini | Butler AI multi-model selector |
| **Anthropic** | Claude Opus 4.6, Sonnet 4.6, Haiku 3.5 | 重量級推理 |
| **Local (Ollama)** | qwen2.5:7b, qwen3:14b, deepseek-r1:14b | 本地優先推理（RTX 4080 SUPER） |

---

## Architecture Version

- **Current**: v2.6.0 (2026 Q2 — Full Service Audit + IAM Auth + SSE Notifications + 17 Cloud Run Services)
- **Last Updated**: 2026-05-12

---

## Documentation Index (`docs/`)

> **維護規則**: 任何規格書進度變更必須同步更新此表。  
> **狀態定義**: ✅ 完成 | 🔧 實作中 | 📄 規格已定 | 📋 計畫中

### 核心文件

| 文件 | 說明 | 狀態 |
|:---|:---|:---:|
| `SYSTEM_ARCHITECTURE.md` | 系統架構總覽 | ✅ |
| `SYSTEM_CONSTITUTION.md` | 系統治理憲章 | ✅ |
| `TECH_STACK.md` | 技術棧說明 | ✅ |
| `API.md` | API 文件 | ✅ |
| `DEPLOYMENT.md` | 部署指南 | ✅ |
| `FEATURES.md` | 功能清單 | ✅ |
| `XXT-AGENT_COMPLETE_DOCUMENTATION.md` | 完整文件彙整 | ✅ |
| `event-schema.md` | Pub/Sub 事件 Schema (v9.0) | ✅ |
| `model_execution_manifest.md` | 模型執行清單 | ✅ |
| `architecture_evolution_spec.md` | 本地模型自我學習進化規格與 DPO 閉環管線 | ✅ |
| `strategic_evolution_nas_stability.md` | 本地全方位助理進化與 NAS 記憶庫穩定方案 | ✅ |
| `xxt_senteng_integration_blueprint.md` | 超級單人企業智能中樞統合藍圖 | ✅ |

### 運維 SOP

| 文件 | 說明 | 狀態 |
|:---|:---|:---:|
| `OPS_RUNBOOK_CLOUD.md` | 雲端運維手冊 (6 章節完整 SOP) | ✅ |
| `SOP_OLLAMA_BASE_URL.md` | 本地推理端點設定 SOP | ✅ |
| `SOP_CHROMADB_NAS.md` | NAS ChromaDB 長期記憶部署 | 📄 待部署 |
| `NPM_AUDIT_SOP.md` | NPM 漏洞審計指引 + CI workflow | ✅ |
| `LOGIN_SYSTEM_AUDIT.md` | 登入系統安全審計報告 | ✅ |
| `OLLAMA_MODEL_STRATEGY.md` | 本地 GPU 模型管理策略 (4 模型 + VRAM 分配) | ✅ |

### 功能規格書

| 文件 | 說明 | 狀態 | 下一步 |
|:---|:---|:---:|:---|
| `DASHBOARD_API_CONTRACT.md` | 5 個 Mock 頁面 → 真實 API 對照 | ✅ 5/5 | 全部頁面已接入 API |
| `COINGECKO_INTEGRATION_SPEC.md` | CoinGecko 加密貨幣新聞來源 | ✅ 已實作 | `news-collector v9.2` 已整合 |
| `BIGQUERY_PIPELINE_SPEC.md` | Pub/Sub → BigQuery 分析管線 | ✅ 腳本就緒 | `infra/scripts/setup_bigquery_pipeline.sh` |
| `LANGGRAPH_INTEGRATION_SPEC.md` | LangGraph State Graph 多 Agent 討論 | ✅ 已實作 | `state-graph.engine.ts` + `/agents/discuss` |

### Telegram Bot

| 文件 | 說明 | 狀態 |
|:---|:---|:---:|
| `services/telegram-command-bot/README.md` | Bot 架構 + 開發指南 | ✅ |
| `services/telegram-command-bot/BOTFATHER_COMMANDS.md` | 27 個指令 BotFather 設定 | ✅ |

### 子目錄

| 路徑 | 內容 |
|:---|:---|
| `docs/governance/` | 治理文件 |
| `docs/proof/` | 驗證記錄 |
| `docs/releases/` | 版本發布紀錄 |

### 新增 API Routes (2026-05-05)

| Route | 用途 | 來源 |
|:---|:---|:---|
| `GET /api/system/gpu` | GPU VRAM 監控 (Ollama `/api/ps`) | 本地 Ollama |
| `GET /api/system/bots/audit` | Bot 指令使用率 audit | OpenClaw Gateway |
| `GET /api/system/nas` | ChromaDB 健康檢查 | NAS ChromaDB |
| `GET /api/system/bots` | Bot 平台連線偵測 | OpenClaw Gateway |

---

## 本地大腦自我自學習系統任務進度 (Investment Brain Self-Learning Backlog)

> **當前狀態**: 🟩 60% 已實裝 (P0 級別回測安全柵欄已上線)

### 🟩 已完成架構與實裝 (Completed)
- [x] **本地 Qwen2.5-7B 模型微調與部署** (支援本地即時多 Agent 整合)
- [x] **市場監督偏好數據收集器** (`market_feedback_loop.py` 行情自動比對與 Chosen/Rejected 打標)
- [x] **顯卡顯存資源鎖與守護進程** (`auto_train_daemon.py` 自動 keep_alive=0 卸載 Ollama 避免 CUDA OOM)
- [x] **P0 級別：自動化回測回歸評估門限** (`auto_regression_gate.py` 安全審查，阻斷劣退模型發佈)
- [x] **進化企劃與規格書制定** (`docs/architecture_evolution_spec.md` 新增核心文檔)

### 🟨 後續開發任務 (Uncompleted Backlog)
- [ ] **P1 級別：GGUF 自動量化發佈管線**
  - 使用 `convert_to_gguf.py` 自動轉製為 `Q4_K_M` 精度，回應縮短至 3s 內，顯存 < 5GB。
- [ ] **P2 級別：Alpha 超額回報打標算法升級**
  - 打標算法升級為基準指數超額收益（相較於 `0050.TW` / `^TWII` 指標增幅 $\ge +1.5\%$）。
- [ ] **P3 級別：法人籌碼與散戶輿情特徵融合**
  - 將外資買賣超、融資融券以及 PTT/Dcard 多空情緒比率注入 `market_context` 特徵向量。
