# XXT-AGENT 系統架構文件

> **版本**: 1.0  
> **最後更新**: 2026-02-04

---

## 1. 系統概覽

**XXT-AGENT** 是一個 AI 智能投資分析平台，整合市場數據監控、新聞分析和社群情緒追蹤，提供 Triple Fusion 三元融合分析能力。

---

## 2. 高階架構圖

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               XXT-AGENT 系統架構                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                           前端層 (Frontend)                              │   │
│   │                                                                         │   │
│   │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │   │              xxt-frontend (Vercel)                              │   │   │
│   │   │              Next.js 14 + React 18 + TailwindCSS                │   │   │
│   │   │              https://xxt-frontend.vercel.app                    │   │   │
│   │   └─────────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         API 閘道層 (API Gateway)                         │   │
│   │                                                                         │   │
│   │   ┌──────────────────┐    ┌──────────────────┐                         │   │
│   │   │   AI Gateway     │    │  Firebase        │                         │   │
│   │   │   (Cloud Run)    │    │  Functions       │                         │   │
│   │   └──────────────────┘    └──────────────────┘                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         微服務層 (Microservices)                         │   │
│   │                                                                         │   │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│   │   │   Market     │ │    News      │ │   Social     │ │   Alert      │   │   │
│   │   │   Streamer   │ │   Collector  │ │   Worker     │ │   Engine     │   │   │
│   │   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│   │                                                                         │   │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│   │   │   Fusion     │ │   Quote      │ │  Telegram    │ │   Trade      │   │   │
│   │   │   Engine     │ │  Normalizer  │ │  Bot         │ │  Planner     │   │   │
│   │   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                          資料層 (Data Layer)                             │   │
│   │                                                                         │   │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│   │   │  Firestore   │ │   Secret     │ │   Cloud      │ │   Notion     │   │   │
│   │   │  (Database)  │ │   Manager    │ │   Storage    │ │   API        │   │   │
│   │   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 前端架構 (Frontend)

### 3.1 技術棧

| 技術 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 14.2 | React 框架 (App Router) |
| **React** | 18.3 | UI 元件庫 |
| **TailwindCSS** | 3.4 | CSS 樣式框架 |
| **Radix UI** | Latest | 無障礙 UI 元件 |
| **SWR** | 2.3 | 資料獲取與快取 |
| **Sentry** | 10.x | 錯誤追蹤 |

### 3.2 頁面結構

```
dashboard/src/app/
├── (app)/                    # 主應用程式群組
│   ├── ai/                   # AI 分析頁面
│   ├── events/               # 事件管理
│   ├── jobs/                 # 任務佇列
│   ├── logs/                 # 系統日誌
│   ├── mappings/             # 資料映射
│   ├── market/               # 市場數據 (8 子功能)
│   ├── metrics/              # 系統指標
│   ├── news/                 # 新聞分析 (5 子功能)
│   ├── portfolio/            # 投資組合
│   ├── rules/                # 規則管理
│   ├── settings/             # 設定
│   ├── social/               # 社群監控 (7 子功能)
│   └── tenants/              # 租戶管理
├── (auth)/                   # 認證頁面群組
└── api/                      # API Routes
    └── admin/                # 後台 API (31 endpoints)
```

---

## 4. 後端架構 (Backend)

### 4.1 Firebase Functions (核心服務)

| 服務 | 檔案 | 描述 |
|------|------|------|
| **lineWebhook** | `webhook.handler.v2.ts` | LINE Webhook 入口 |
| **lineWorker** | `worker.handler.ts` | 任務處理工作器 |
| **lineCleanup** | `cleanup.handler.ts` | 資料清理服務 |
| **fusionEngine** | `fusion-engine.handler.ts` | 事件融合引擎 |
| **marketStreamer** | `market-streamer.handler.ts` | 市場數據串流 |
| **socialCollector** | `social-collector.handler.ts` | 社群數據收集 |
| **socialDispatcher** | `social-dispatcher.handler.ts` | 社群事件分發 |

### 4.2 核心服務模組

```
functions/src/services/
├── fusion-engine.service.ts      # 事件融合引擎
├── gemini-enricher.service.ts    # Gemini AI 增強
├── market-streamer.service.ts    # 市場串流
├── social-collector.service.ts   # 社群收集
├── social-dispatcher.service.ts  # 社群分發
├── alert-engine.service.ts       # 警報引擎
├── notion.service.ts             # Notion 整合
├── notion-mapper.service.ts      # 資料映射
├── line.service.ts               # LINE 整合
├── queue.service.ts              # 任務佇列
├── rules.service.ts              # 規則引擎
├── tenant.service.ts             # 多租戶管理
├── secrets.service.ts            # 密鑰管理
├── storage.service.ts            # 檔案儲存
├── cleanup.service.ts            # 清理服務
├── audit.service.ts              # 稽核日誌
├── metrics.service.ts            # 指標收集
└── observability.service.ts      # 可觀測性
```

---

## 5. 微服務架構 (Microservices)

### 5.1 服務清單

| 服務 | 路徑 | 功能描述 |
|------|------|----------|
| **ai-gateway** | `services/ai-gateway/` | Gemini API 安全閘道 |
| **alert-engine** | `services/alert-engine/` | 警報觸發與通知 |
| **event-fusion-engine** | `services/event-fusion-engine/` | 跨域事件融合 |
| **market-streamer** | `services/market-streamer/` | 即時市場數據串流 |
| **news-collector** | `services/news-collector/` | 新聞爬蟲與收集 |
| **quote-normalizer** | `services/quote-normalizer/` | 報價標準化處理 |
| **social-dispatcher** | `services/social-dispatcher/` | 社群事件分發 |
| **social-worker** | `services/social-worker/` | 社群數據處理 |
| **telegram-command-bot** | `services/telegram-command-bot/` | Telegram 機器人 |
| **trade-planner-worker** | `services/trade-planner-worker/` | 交易計畫生成 |

### 5.2 共用模組

```
services/common/              # 共用程式碼
├── config/                   # 共用配置
├── types/                    # 共用類型
└── utils/                    # 共用工具
```

---

## 6. 資料流架構

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Market     │     │    News      │     │   Social     │
│   Sources    │     │   Sources    │     │   Platforms  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Market     │     │    News      │     │   Social     │
│   Streamer   │     │   Collector  │     │   Worker     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │   Fusion Engine  │
                  │   (Triple Fusion)│
                  └────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌───────────┐ ┌───────────┐ ┌───────────┐
       │  Gemini   │ │  Alert    │ │  Trade    │
       │  Enricher │ │  Engine   │ │  Planner  │
       └───────────┘ └───────────┘ └───────────┘
```

---

## 7. 部署架構

| 組件 | 平台 | URL/位置 |
|------|------|----------|
| **Frontend** | Vercel | `xxt-frontend.vercel.app` |
| **Functions** | Firebase | GCP `xxt-agent` |
| **Microservices** | Cloud Run | GCP `asia-east1` |
| **Database** | Firestore | Firebase |
| **Secrets** | Secret Manager | GCP |
| **Storage** | Cloud Storage | GCP |

---

## 8. 安全架構

1. **認證**: Firebase Authentication
2. **授權**: 自定義 RBAC (Role-Based Access Control)
3. **密鑰管理**: Google Secret Manager
4. **API 安全**: AI Gateway 代理所有 Gemini API 呼叫
5. **監控**: Sentry (前端), Cloud Logging (後端)
