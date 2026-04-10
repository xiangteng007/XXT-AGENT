# XXT-AGENT Platform - Project Configuration

> **最後更新**: 2026-03-27

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
| **OpenClaw Gateway** | Cloud Run | `services/openclaw-gateway` | ✅ Active |
| **Secret Manager** | GCP | — | ✅ Active |

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
| **OpenClaw Gateway** | `services/openclaw-gateway/` |
| **Microservices** | `services/` |
| **Shared Types** | `packages/types/` |
| **Infrastructure** | `infra/` |

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

## AI Model Support (2026 Q1)

| Provider | 模型 |
|----------|------|
| **Google Gemini** | Gemini 3.1 Pro, 2.5 Pro/Flash, 2.0 Flash/Lite |
| **OpenAI** | GPT-5.4, o4-mini, GPT-4o, GPT-4o-mini |
| **Anthropic** | Claude Opus 4.6, Sonnet 4.6, Haiku 3.5 |

---

## Architecture Version

- **Current**: v2.1.0 (2026 Q1 Model Upgrade + MCP-ready)
- **Last Updated**: 2026-03-27
