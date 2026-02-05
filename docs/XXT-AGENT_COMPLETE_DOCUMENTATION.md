# XXT-AGENT 完整系統文件

> **版本**: 1.0  
> **生效日期**: 2026-02-04  
> **最後更新**: 2026-02-04

---

# 目錄

1. [系統憲法](#第一部分系統憲法)
2. [系統架構](#第二部分系統架構)
3. [技術棧](#第三部分技術棧)
4. [功能規格](#第四部分功能規格)
5. [API 文件](#第五部分api-文件)
6. [部署指南](#第六部分部署指南)
7. [專案配置](#第七部分專案配置)

---

# 第一部分：系統憲法

## 1.1 專案定義

**XXT-AGENT** 是一個 AI 智能投資分析平台，整合以下核心功能：

1. **市場數據監控** - 即時追蹤金融市場動態
2. **新聞分析** - AI 驅動的新聞情緒分析
3. **社群追蹤** - 社群媒體情緒監控與趨勢分析
4. **Triple Fusion** - 市場、新聞、社群數據三元融合分析

## 1.2 前端部署

| 項目 | 值 |
|------|-----|
| **平台** | Vercel |
| **專案名稱** | xxt-frontend |
| **URL** | https://xxt-frontend.vercel.app |
| **GitHub Repo** | [xiangteng007/XXT-frontend](https://github.com/xiangteng007/XXT-frontend) |
| **狀態** | ✅ Active |

## 1.3 後端部署

| 項目 | 值 |
|------|-----|
| **平台** | Google Cloud Platform (GCP) |
| **GCP 專案名稱** | XXT-AGENT |
| **GCP 專案 ID** | xxt-agent |
| **GCP 專案編號** | 257379536720 |
| **區域** | asia-east1 (Taiwan) |
| **主要服務** | Cloud Functions, Cloud Run, Firestore |

## 1.4 GitHub Repository

| 倉庫 | URL |
|------|-----|
| **主倉庫 (Backend)** | [github.com/xiangteng007/XXT-AGENT](https://github.com/xiangteng007/XXT-AGENT) |
| **前端倉庫** | [github.com/xiangteng007/XXT-frontend](https://github.com/xiangteng007/XXT-frontend) |

**倉庫資訊**:
- 主分支: `main`
- 分支數量: 20
- 可見性: Public

## 1.5 本地開發路徑

| 組件 | 路徑 |
|------|------|
| **Backend (Functions)** | `c:\Users\xiang\XXT-AGENT\functions\` |
| **Frontend (Dashboard)** | `c:\Users\xiang\XXT-AGENT\dashboard\` |
| **Services** | `c:\Users\xiang\XXT-AGENT\services\` |
| **Infrastructure** | `c:\Users\xiang\XXT-AGENT\infra\` |

## 1.6 GCP 資源連結

| 資源 | URL |
|------|-----|
| **GCP Console** | https://console.cloud.google.com/welcome?project=xxt-agent |
| **Cloud Run** | https://console.cloud.google.com/run?project=xxt-agent |
| **Cloud Functions** | https://console.cloud.google.com/functions?project=xxt-agent |
| **Firestore** | https://console.firebase.google.com/project/xxt-agent/firestore |
| **Secret Manager** | https://console.cloud.google.com/security/secret-manager?project=xxt-agent |

---

# 第二部分：系統架構

## 2.1 系統概覽

**XXT-AGENT** 是一個 AI 智能投資分析平台，整合市場數據監控、新聞分析和社群情緒追蹤，提供 Triple Fusion 三元融合分析能力。

## 2.2 高階架構圖

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

## 2.3 前端架構

### 2.3.1 技術棧

| 技術 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 14.2 | React 框架 (App Router) |
| **React** | 18.3 | UI 元件庫 |
| **TailwindCSS** | 3.4 | CSS 樣式框架 |
| **Radix UI** | Latest | 無障礙 UI 元件 |
| **SWR** | 2.3 | 資料獲取與快取 |
| **Sentry** | 10.x | 錯誤追蹤 |

### 2.3.2 頁面結構

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

## 2.4 後端架構

### 2.4.1 Firebase Functions (核心服務)

| 服務 | 檔案 | 描述 |
|------|------|------|
| **lineWebhook** | `webhook.handler.v2.ts` | LINE Webhook 入口 |
| **lineWorker** | `worker.handler.ts` | 任務處理工作器 |
| **lineCleanup** | `cleanup.handler.ts` | 資料清理服務 |
| **fusionEngine** | `fusion-engine.handler.ts` | 事件融合引擎 |
| **marketStreamer** | `market-streamer.handler.ts` | 市場數據串流 |
| **socialCollector** | `social-collector.handler.ts` | 社群數據收集 |
| **socialDispatcher** | `social-dispatcher.handler.ts` | 社群事件分發 |

### 2.4.2 核心服務模組

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

## 2.5 微服務架構

### 2.5.1 服務清單

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

### 2.5.2 共用模組

```
services/common/              # 共用程式碼
├── config/                   # 共用配置
├── types/                    # 共用類型
└── utils/                    # 共用工具
```

## 2.6 資料流架構

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

## 2.7 部署架構

| 組件 | 平台 | URL/位置 |
|------|------|----------|
| **Frontend** | Vercel | `xxt-frontend.vercel.app` |
| **Functions** | Firebase | GCP `xxt-agent` |
| **Microservices** | Cloud Run | GCP `asia-east1` |
| **Database** | Firestore | Firebase |
| **Secrets** | Secret Manager | GCP |
| **Storage** | Cloud Storage | GCP |

## 2.8 安全架構

1. **認證**: Firebase Authentication
2. **授權**: 自定義 RBAC (Role-Based Access Control)
3. **密鑰管理**: Google Secret Manager
4. **API 安全**: AI Gateway 代理所有 Gemini API 呼叫
5. **監控**: Sentry (前端), Cloud Logging (後端)

---

# 第三部分：技術棧

## 3.1 前端技術棧

### 3.1.1 核心框架

| 技術 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 14.2.35 | React 全端框架 (App Router) |
| **React** | 18.3.1 | UI 元件庫 |
| **React DOM** | 18.3.1 | React DOM 渲染 |
| **TypeScript** | 5.4.5 | 靜態類型檢查 |

### 3.1.2 UI / 樣式

| 技術 | 版本 | 用途 |
|------|------|------|
| **TailwindCSS** | 3.4.17 | Utility-first CSS 框架 |
| **Radix UI** | Latest | 無障礙原始 UI 元件 |
| **Lucide React** | 0.562.0 | 圖標庫 |
| **class-variance-authority** | 0.7.1 | 元件變體管理 |
| **clsx** | 2.1.1 | 條件式 className |
| **tailwind-merge** | 3.4.0 | TailwindCSS 類別合併 |
| **tailwindcss-animate** | 1.0.7 | 動畫擴充套件 |

### 3.1.3 Radix UI 元件

| 元件 | 用途 |
|------|------|
| `@radix-ui/react-dialog` | 對話框 / Modal |
| `@radix-ui/react-dropdown-menu` | 下拉選單 |
| `@radix-ui/react-label` | 表單標籤 |
| `@radix-ui/react-select` | 選擇器 |
| `@radix-ui/react-separator` | 分隔線 |
| `@radix-ui/react-slot` | Slot 元件 |
| `@radix-ui/react-switch` | 開關切換 |
| `@radix-ui/react-tabs` | 分頁標籤 |

### 3.1.4 資料獲取與狀態

| 技術 | 版本 | 用途 |
|------|------|------|
| **SWR** | 2.3.8 | 資料獲取、快取、重新驗證 |
| **Firebase** | 10.12.0 | 客戶端 Firebase SDK |

### 3.1.5 監控與錯誤追蹤

| 技術 | 版本 | 用途 |
|------|------|------|
| **@sentry/nextjs** | 10.34.0 | 錯誤追蹤與效能監控 |

### 3.1.6 開發工具

| 技術 | 版本 | 用途 |
|------|------|------|
| **ESLint** | 8.57.0 | 程式碼品質檢查 |
| **eslint-config-next** | 16.1.4 | Next.js ESLint 配置 |
| **PostCSS** | 8.5.6 | CSS 後處理器 |
| **Autoprefixer** | 10.4.23 | CSS 前綴自動添加 |

## 3.2 後端技術棧 (Firebase Functions)

### 3.2.1 核心框架

| 技術 | 版本 | 用途 |
|------|------|------|
| **Firebase Functions** | 7.0.3 | Serverless 函數框架 |
| **Firebase Admin** | 13.6.0 | 後端 Firebase SDK |
| **Node.js** | 20 | JavaScript 執行環境 |
| **TypeScript** | 5.7.2 | 靜態類型檢查 |

### 3.2.2 Google Cloud 服務

| 技術 | 版本 | 用途 |
|------|------|------|
| **@google-cloud/secret-manager** | 5.6.0 | 密鑰管理 |
| **@google-cloud/tasks** | 6.2.1 | 雲端任務佇列 |
| **@google/generative-ai** | 0.24.1 | Gemini AI API |

### 3.2.3 第三方整合

| 技術 | 版本 | 用途 |
|------|------|------|
| **@notionhq/client** | 2.2.15 | Notion API 客戶端 |

### 3.2.4 資料驗證

| 技術 | 版本 | 用途 |
|------|------|------|
| **Zod** | 4.3.5 | Schema 驗證與類型推導 |

### 3.2.5 開發與測試

| 技術 | 版本 | 用途 |
|------|------|------|
| **Jest** | 29.7.0 | 單元測試框架 |
| **ts-jest** | 29.2.5 | Jest TypeScript 支援 |
| **ESLint** | 8.57.1 | 程式碼品質 |
| **@typescript-eslint/parser** | 8.19.0 | TypeScript ESLint 解析 |
| **firebase-functions-test** | 3.3.0 | Functions 測試工具 |

## 3.3 微服務技術棧

### 3.3.1 AI Gateway

| 技術 | 版本 | 用途 |
|------|------|------|
| **Express** | 4.18.2 | Web 框架 |
| **@google/generative-ai** | 0.21.0 | Gemini AI API |
| **@google-cloud/secret-manager** | 5.0.0 | 密鑰管理 |
| **cors** | 2.8.5 | 跨域支援 |

### 3.3.2 共用技術

所有微服務共用:
- **TypeScript** - 類型安全
- **Docker** - 容器化
- **Cloud Run** - 部署平台

## 3.4 雲端基礎設施

### 3.4.1 Google Cloud Platform (GCP)

| 服務 | 用途 |
|------|------|
| **Cloud Functions** | Serverless 函數 |
| **Cloud Run** | 容器化微服務 |
| **Firestore** | NoSQL 文件資料庫 |
| **Cloud Storage** | 物件儲存 |
| **Secret Manager** | 密鑰管理 |
| **Cloud Tasks** | 任務佇列 |
| **Cloud Logging** | 日誌管理 |
| **Cloud Monitoring** | 效能監控 |

### 3.4.2 Firebase

| 服務 | 用途 |
|------|------|
| **Firebase Authentication** | 使用者認證 |
| **Firestore** | 即時資料庫 |
| **Firebase Hosting** | 靜態內容託管 |

### 3.4.3 Vercel

| 服務 | 用途 |
|------|------|
| **Vercel Platform** | 前端部署與 CDN |
| **Edge Functions** | 邊緣運算 |

## 3.5 技術棧版本總覽

```
Frontend (Next.js 14)
├── React 18.3
├── TypeScript 5.4
├── TailwindCSS 3.4
├── Radix UI (Latest)
└── SWR 2.3

Backend (Firebase Functions)
├── Node.js 20
├── TypeScript 5.7
├── Firebase Admin 13.6
├── Zod 4.3
└── Gemini AI 0.24

Microservices (Cloud Run)
├── Express 4.18
├── TypeScript 5.x
└── Docker

Infrastructure
├── GCP (xxt-agent)
├── Firebase
└── Vercel
```

---

# 第四部分：功能規格

## 4.1 Triple Fusion 三元融合分析

XXT-AGENT 的核心是 **Triple Fusion Engine**，整合三大數據來源進行綜合分析：

| 數據來源 | 描述 | 對應服務 |
|----------|------|----------|
| **市場數據 (Market)** | 即時金融市場報價、趨勢 | `market-streamer` |
| **新聞分析 (News)** | 財經新聞、事件追蹤 | `news-collector` |
| **社群情緒 (Social)** | 社群媒體情緒、輿論風向 | `social-worker` |

```
Market Data ─────┐
                 │
News Data ───────┼──► Fusion Engine ──► AI Enrichment ──► Alerts
                 │                                         │
Social Data ─────┘                                         ▼
                                                    Trade Signals
```

## 4.2 前端功能模組

### 4.2.1 Dashboard 儀表板

| 功能 | 路徑 | 描述 |
|------|------|------|
| **首頁概覽** | `/` | 系統狀態、關鍵指標摘要 |
| **即時指標** | 首頁 | 事件數、警報數、處理狀態 |

### 4.2.2 AI 分析模組

| 功能 | 路徑 | 描述 |
|------|------|------|
| **AI 儀表板** | `/ai` | Gemini AI 分析結果展示 |
| **智能洞察** | `/ai` | AI 生成的投資建議 |

### 4.2.3 市場數據模組 (`/market`)

| 功能 | 描述 |
|------|------|
| **即時報價** | 股票、期貨、基金即時價格 |
| **趨勢分析** | 價格走勢、技術指標 |
| **異動警報** | 價格異常波動通知 |
| **歷史數據** | 歷史價格查詢 |

### 4.2.4 新聞分析模組 (`/news`)

| 功能 | 描述 |
|------|------|
| **新聞列表** | 財經新聞聚合 |
| **情緒分析** | AI 驅動的新聞情緒標記 |
| **關鍵字追蹤** | 自定義關鍵字監控 |
| **新聞分類** | 按類別、來源分類 |
| **影響評估** | 新聞對市場的潛在影響 |

### 4.2.5 社群監控模組 (`/social`)

| 功能 | 描述 |
|------|------|
| **社群動態** | 社群媒體內容追蹤 |
| **情緒儀表板** | 整體社群情緒指標 |
| **熱門話題** | 趨勢話題識別 |
| **KOL 追蹤** | 意見領袖動態監控 |
| **病毒式傳播追蹤** | 快速傳播內容識別 |

### 4.2.6 投資組合模組 (`/portfolio`)

| 功能 | 描述 |
|------|------|
| **持倉管理** | 投資組合持倉追蹤 |
| **績效分析** | 收益率、風險指標 |

### 4.2.7 系統管理模組

| 功能 | 路徑 | 描述 |
|------|------|------|
| **事件管理** | `/events` | 系統事件查看 |
| **任務佇列** | `/jobs` | 背景任務監控 |
| **系統日誌** | `/logs` | 操作日誌查詢 |
| **資料映射** | `/mappings` | 資料欄位映射設定 |
| **規則管理** | `/rules` | 分析規則配置 |
| **系統指標** | `/metrics` | 效能指標監控 |
| **租戶管理** | `/tenants` | 多租戶配置 |
| **系統設定** | `/settings` | 全域設定 |

## 4.3 後端功能服務

### 4.3.1 LINE 整合

| 功能 | 服務 | 描述 |
|------|------|------|
| **Webhook 接收** | `lineWebhook` | 接收 LINE 訊息事件 |
| **訊息處理** | `lineWorker` | 處理訊息並寫入 Notion |
| **簽章驗證** | `line.service` | LINE 訊息安全驗證 |

### 4.3.2 Notion 整合

| 功能 | 服務 | 描述 |
|------|------|------|
| **資料寫入** | `notion.service` | 寫入 Notion Database |
| **欄位映射** | `notion-mapper.service` | 動態欄位對應 |

### 4.3.3 AI 服務

| 功能 | 服務 | 描述 |
|------|------|------|
| **內容增強** | `gemini-enricher.service` | Gemini AI 內容分析 |
| **嚴重度評分** | Gemini | 事件嚴重度 0-100 評分 |
| **情緒分析** | Gemini | positive/negative/neutral |
| **實體識別** | Gemini | ticker/topic/location/person |
| **關鍵字提取** | Gemini | 自動關鍵字萃取 |

### 4.3.4 事件融合

| 功能 | 服務 | 描述 |
|------|------|------|
| **跨域關聯** | `fusion-engine.service` | 市場+新聞+社群事件關聯 |
| **時間窗口匹配** | Fusion | 10 分鐘滑動窗口 |
| **嚴重度增強** | Fusion | 多源事件嚴重度提升 |

### 4.3.5 警報系統

| 功能 | 服務 | 描述 |
|------|------|------|
| **警報觸發** | `alert-engine.service` | 條件式警報觸發 |
| **通知發送** | Alert | 多通道通知 (LINE/Telegram) |

### 4.3.6 規則引擎

| 功能 | 服務 | 描述 |
|------|------|------|
| **關鍵字匹配** | `rules.service` | 關鍵字/正則規則匹配 |
| **動態規則** | Rules | 可配置的分析規則 |

## 4.4 微服務功能

### 4.4.1 AI Gateway

| 功能 | 描述 |
|------|------|
| **API 代理** | 安全代理 Gemini API 請求 |
| **速率限制** | 防止 API 濫用 |
| **密鑰管理** | Secret Manager 整合 |

### 4.4.2 Market Streamer

| 功能 | 描述 |
|------|------|
| **即時串流** | 市場數據即時獲取 |
| **報價標準化** | 統一報價格式 |
| **異動偵測** | 價格異常監控 |

### 4.4.3 News Collector

| 功能 | 描述 |
|------|------|
| **新聞爬蟲** | 多來源新聞收集 |
| **內容解析** | 新聞內容結構化 |
| **重複偵測** | 避免重複內容 |

### 4.4.4 Social Worker

| 功能 | 描述 |
|------|------|
| **社群監控** | 社群平台內容追蹤 |
| **情緒分析** | 社群情緒量化 |
| **趨勢識別** | 熱門話題追蹤 |

### 4.4.5 Telegram Bot

| 功能 | 描述 |
|------|------|
| **命令處理** | Telegram 機器人指令 |
| **警報推送** | 即時警報通知 |
| **查詢功能** | 市場/新聞即時查詢 |

### 4.4.6 Trade Planner

| 功能 | 描述 |
|------|------|
| **交易訊號** | AI 生成交易建議 |
| **風險評估** | 交易風險分析 |
| **計畫生成** | 自動交易計畫 |

## 4.5 非功能性特性

### 4.5.1 效能

| 特性 | 描述 |
|------|------|
| **快速 ACK** | Webhook 5秒內回應 |
| **非同步處理** | 背景任務佇列 |
| **邊緣快取** | Vercel Edge 快取 |

### 4.5.2 可擴展性

| 特性 | 描述 |
|------|------|
| **多租戶** | 支援多團隊獨立配置 |
| **自動擴展** | Cloud Run 自動擴容 |
| **微服務架構** | 獨立擴展各服務 |

### 4.5.3 安全

| 特性 | 描述 |
|------|------|
| **LINE 簽章驗證** | Webhook 來源驗證 |
| **Secret Manager** | 密鑰安全儲存 |
| **RBAC** | 角色權限控制 |

### 4.5.4 可觀測性

| 特性 | 描述 |
|------|------|
| **結構化日誌** | Cloud Logging 整合 |
| **錯誤追蹤** | Sentry 即時監控 |
| **效能指標** | 自定義 Metrics |

---

# 第五部分：API 文件

## 5.1 API 概覽

| 項目 | 值 |
|------|-----|
| **後端 URL** | Firebase Functions (asia-east1) |
| **認證方式** | Firebase Authentication |
| **回應格式** | JSON |

## 5.2 Firebase Functions Endpoints

### 5.2.1 LINE Webhook

```http
POST /lineWebhook
```

**描述**: 接收 LINE 平台 Webhook 事件

**Headers**:
| Header | 必要 | 描述 |
|--------|------|------|
| `X-Line-Signature` | 是 | LINE 簽章驗證 |
| `Content-Type` | 是 | application/json |

**Request Body**:
```json
{
  "destination": "channel_id",
  "events": [
    {
      "type": "message",
      "message": {
        "type": "text",
        "text": "#todo 買菜"
      },
      "replyToken": "...",
      "source": {
        "type": "user",
        "userId": "..."
      }
    }
  ]
}
```

**Response**: `200 OK`
```json
{ "status": "accepted", "jobIds": ["job_123"] }
```

### 5.2.2 LINE Worker

```http
POST /lineWorker
```

**描述**: 手動觸發任務處理（用於測試）

**Response**: `200 OK`
```json
{
  "status": "completed",
  "processed": 5,
  "failed": 0
}
```

### 5.2.3 LINE Cleanup

```http
POST /lineCleanup
```

**描述**: 手動觸發資料清理

**Response**: `200 OK`
```json
{
  "status": "completed",
  "cleaned": {
    "jobs": 10,
    "logs": 50,
    "images": 5
  }
}
```

## 5.3 前端 API Routes

所有 API 位於 `/api/admin/` 路徑下。

### 5.3.1 Events API

```http
GET /api/admin/events
```

**描述**: 獲取系統事件列表

**Query Parameters**:
| 參數 | 類型 | 描述 |
|------|------|------|
| `limit` | number | 限制筆數 (預設 50) |
| `domain` | string | 過濾域 (market/news/social) |

### 5.3.2 Jobs API

```http
GET /api/admin/jobs
POST /api/admin/jobs/retry
```

**描述**: 獲取任務佇列、重試失敗任務

### 5.3.3 Logs API

```http
GET /api/admin/logs
```

**描述**: 獲取系統日誌

### 5.3.4 Tenants API

```http
GET /api/admin/tenants
POST /api/admin/tenants
PUT /api/admin/tenants/:id
DELETE /api/admin/tenants/:id
```

**描述**: 租戶 CRUD 操作

### 5.3.5 Rules API

```http
GET /api/admin/rules
POST /api/admin/rules
PUT /api/admin/rules/:id
DELETE /api/admin/rules/:id
```

**描述**: 規則 CRUD 操作

### 5.3.6 Metrics API

```http
GET /api/admin/metrics
```

**描述**: 獲取系統指標

## 5.4 AI Gateway API

### 5.4.1 Enrich Content

```http
POST /api/enrich
```

**Host**: `ai-gateway-*.run.app`

**Request Body**:
```json
{
  "type": "social",
  "content": "市場大跌，恐慌情緒蔓延",
  "context": {
    "platform": "twitter",
    "location": "tw"
  }
}
```

**Response**:
```json
{
  "severity": 75,
  "sentiment": "negative",
  "keywords": ["市場", "大跌", "恐慌"],
  "entities": [
    { "type": "topic", "value": "市場恐慌" }
  ],
  "impactHint": "可能引發進一步拋售",
  "rationale": "負面情緒詞彙密集，嚴重度評估為高"
}
```

## 5.5 資料模型

### 5.5.1 Job (任務)

```typescript
interface Job {
  id: string;
  tenantId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: {
    eventType: string;
    messageId: string;
    content: string;
  };
  retryCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 5.5.2 Event (事件)

```typescript
interface Event {
  id: string;
  domain: 'market' | 'news' | 'social' | 'fused';
  severity: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  content: string;
  entities: Entity[];
  createdAt: Timestamp;
}
```

### 5.5.3 Entity (實體)

```typescript
interface Entity {
  type: 'ticker' | 'fund' | 'future' | 'topic' | 'location' | 'person' | 'org';
  value: string;
  confidence?: number;
}
```

### 5.5.4 Tenant (租戶)

```typescript
interface Tenant {
  id: string;
  name: string;
  lineChannelId: string;
  notionDatabaseId: string;
  active: boolean;
  createdAt: Timestamp;
}
```

### 5.5.5 Rule (規則)

```typescript
interface Rule {
  id: string;
  tenantId: string;
  name: string;
  type: 'keyword' | 'regex';
  pattern: string;
  targetDatabase: string;
  fieldMappings: Record<string, string>;
  active: boolean;
}
```

## 5.6 錯誤處理

### 5.6.1 錯誤回應格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "content",
      "reason": "required"
    }
  }
}
```

### 5.6.2 錯誤代碼

| Code | HTTP Status | 描述 |
|------|-------------|------|
| `VALIDATION_ERROR` | 400 | 請求驗證失敗 |
| `UNAUTHORIZED` | 401 | 未授權 |
| `FORBIDDEN` | 403 | 權限不足 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `RATE_LIMITED` | 429 | 請求過於頻繁 |
| `INTERNAL_ERROR` | 500 | 伺服器錯誤 |

---

# 第六部分：部署指南

## 6.1 部署概覽

| 組件 | 平台 | 部署方式 |
|------|------|----------|
| **Frontend** | Vercel | Git Push (自動) |
| **Functions** | Firebase | `firebase deploy` |
| **Microservices** | Cloud Run | `gcloud run deploy` |

## 6.2 前端部署 (Vercel)

### 6.2.1 專案設定

| 設定 | 值 |
|------|-----|
| **專案名稱** | xxt-frontend |
| **GitHub Repo** | xiangteng007/XXT-frontend |
| **Framework** | Next.js |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |

### 6.2.2 自動部署

```bash
# 推送到 main 分支自動觸發部署
git push origin main
```

### 6.2.3 手動部署

```bash
cd dashboard
npm install
npm run build
npx vercel --prod
```

### 6.2.4 環境變數

在 Vercel Dashboard 設定：

| 變數名稱 | 描述 |
|----------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API Key |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 專案 ID |
| `SENTRY_DSN` | Sentry DSN |

## 6.3 Firebase Functions 部署

### 6.3.1 前置作業

```bash
# 安裝 Firebase CLI
npm install -g firebase-tools

# 登入
firebase login

# 選擇專案
firebase use xxt-agent
```

### 6.3.2 部署指令

```bash
cd functions

# 安裝依賴
npm install

# 編譯 TypeScript
npm run build

# 部署所有 Functions
firebase deploy --only functions

# 部署特定 Function
firebase deploy --only functions:lineWebhook
```

### 6.3.3 設定 Secrets

```bash
# 設定 LINE Channel Secret
firebase functions:secrets:set LINE_CHANNEL_SECRET

# 設定 Notion Token
firebase functions:secrets:set NOTION_TOKEN

# 設定 Gemini API Key
firebase functions:secrets:set GEMINI_API_KEY
```

## 6.4 微服務部署 (Cloud Run)

### 6.4.1 通用部署流程

```bash
cd services/<service-name>

# 建置 Docker 映像
docker build -t gcr.io/xxt-agent/<service-name> .

# 推送到 Container Registry
docker push gcr.io/xxt-agent/<service-name>

# 部署到 Cloud Run
gcloud run deploy <service-name> \
  --image gcr.io/xxt-agent/<service-name> \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated
```

### 6.4.2 AI Gateway 部署

```bash
cd services/ai-gateway

gcloud run deploy ai-gateway \
  --source . \
  --region asia-east1 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --allow-unauthenticated
```

## 6.5 GCP 專案設定

### 6.5.1 專案資訊

| 項目 | 值 |
|------|-----|
| **專案名稱** | XXT-AGENT |
| **專案 ID** | xxt-agent |
| **專案編號** | 257379536720 |
| **區域** | asia-east1 |

### 6.5.2 啟用必要 API

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  cloudbuild.googleapis.com
```

### 6.5.3 Secret Manager 設定

```bash
# 建立 Secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "your-api-key" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 授權 Cloud Run 存取
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:xxt-agent@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 6.6 CI/CD (GitHub Actions)

### 6.6.1 所需 Secrets

在 GitHub Repo Settings > Secrets 設定：

| Secret | 描述 |
|--------|------|
| `GCP_SA_KEY` | GCP Service Account Key (JSON) |
| `FIREBASE_PROJECT_ID` | Firebase 專案 ID |
| `VERCEL_TOKEN` | Vercel 部署 Token |

### 6.6.2 自動觸發

- **main 分支推送**: 觸發生產環境部署
- **Pull Request**: 觸發預覽部署

## 6.7 本地開發

### 6.7.1 環境設定

```bash
# 複製環境變數範本
cp .env.example .env.local

# 編輯環境變數
code .env.local
```

### 6.7.2 啟動前端

```bash
cd dashboard
npm install
npm run dev
# 訪問 http://localhost:3000
```

### 6.7.3 啟動 Functions Emulator

```bash
cd functions
npm install
npm run build
firebase emulators:start
```

### 6.7.4 啟動微服務

```bash
cd services
docker-compose -f docker-compose.dev.yml up
```

## 6.8 監控與日誌

### 6.8.1 GCP Console 連結

| 資源 | URL |
|------|-----|
| **總覽** | https://console.cloud.google.com/welcome?project=xxt-agent |
| **Cloud Run** | https://console.cloud.google.com/run?project=xxt-agent |
| **Cloud Functions** | https://console.cloud.google.com/functions?project=xxt-agent |
| **Firestore** | https://console.firebase.google.com/project/xxt-agent/firestore |
| **Logs** | https://console.cloud.google.com/logs?project=xxt-agent |

### 6.8.2 Sentry (前端)

- Dashboard: https://sentry.io
- 專案: xxt-frontend

## 6.9 故障排除

### 6.9.1 常見問題

| 問題 | 解決方案 |
|------|----------|
| Functions 部署失敗 | 檢查 `npm run build` 是否成功 |
| Secret 存取被拒 | 確認 IAM 權限設定 |
| Cloud Run 503 | 檢查容器啟動日誌 |
| Vercel 建置失敗 | 檢查 Next.js 編譯錯誤 |

### 6.9.2 日誌查看

```bash
# Firebase Functions 日誌
firebase functions:log

# Cloud Run 日誌
gcloud run services logs read <service-name> --region asia-east1
```

---

# 第七部分：專案配置

## 7.1 專案概覽

**XXT-AGENT** 是一個 AI 智能投資分析平台，整合市場數據監控、新聞分析和社群情緒追蹤。

## 7.2 GitHub Repository

| 項目 | 資訊 |
|------|------|
| **主倉庫 (Backend/Functions)** | [xiangteng007/XXT-AGENT](https://github.com/xiangteng007/XXT-AGENT) |
| **前端倉庫** | [xiangteng007/XXT-frontend](https://github.com/xiangteng007/XXT-frontend) |
| **主分支** | `main` |
| **分支數量** | 20 Branches |
| **可見性** | Public |

## 7.3 GCP Project

| 欄位 | 值 |
|------|-----|
| **專案名稱** | XXT-AGENT |
| **專案 ID** | xxt-agent |
| **專案編號** | 257379536720 |
| **區域** | asia-east1 (Taiwan) |

## 7.4 Deployed Services

### Frontend (Vercel)

| 項目 | 資訊 |
|------|------|
| **平台** | Vercel |
| **專案名稱** | xxt-frontend |
| **URL** | [https://xxt-frontend.vercel.app](https://xxt-frontend.vercel.app) |
| **GitHub Repo** | xiangteng007/XXT-frontend |
| **狀態** | ✅ Active |

### Backend (Google Cloud)

| Service | 平台 | 狀態 |
|---------|------|------|
| **Cloud Functions** | Firebase Functions | ✅ Active |
| **Firestore** | Firebase | ✅ Active |
| **Cloud Run** | GCP | ✅ Active |

## 7.5 URLs

- **GCP Console**: https://console.cloud.google.com/welcome?project=xxt-agent
- **Cloud Run**: https://console.cloud.google.com/run?project=xxt-agent
- **Secret Manager**: https://console.cloud.google.com/security/secret-manager?project=xxt-agent
- **Firestore**: https://console.firebase.google.com/project/xxt-agent/firestore

## 7.6 Local Development Paths

| 組件 | 路徑 |
|------|------|
| **Backend (Functions)** | `c:\Users\xiang\XXT-AGENT\functions\` |
| **Frontend (Dashboard)** | `c:\Users\xiang\XXT-AGENT\dashboard\` |
| **Services** | `c:\Users\xiang\XXT-AGENT\services\` |
| **Infrastructure** | `c:\Users\xiang\XXT-AGENT\infra\` |

## 7.7 Architecture Version

- **Current**: v2.0.0 (Production-Grade Upgrade)
- **Last Updated**: 2026-02-04

---

# 附錄

## 版本歷史

| 版本 | 日期 | 更新內容 |
|------|------|----------|
| v1.0 | 2026-02-04 | 初版建立，整合所有系統文件 |

---

> ✅ **XXT-AGENT 完整系統文件 v1.0 - 前端部署於 Vercel (xxt-frontend)，後端部署於 GCP (xxt-agent 專案)。**

*本文件為 XXT-AGENT 專案完整技術文件。*
