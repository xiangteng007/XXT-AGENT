# XXT-AGENT 技術棧文件

> **版本**: 1.0  
> **最後更新**: 2026-02-04

---

## 1. 前端技術棧

### 1.1 核心框架

| 技術 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 14.2.35 | React 全端框架 (App Router) |
| **React** | 18.3.1 | UI 元件庫 |
| **React DOM** | 18.3.1 | React DOM 渲染 |
| **TypeScript** | 5.4.5 | 靜態類型檢查 |

### 1.2 UI / 樣式

| 技術 | 版本 | 用途 |
|------|------|------|
| **TailwindCSS** | 3.4.17 | Utility-first CSS 框架 |
| **Radix UI** | Latest | 無障礙原始 UI 元件 |
| **Lucide React** | 0.562.0 | 圖標庫 |
| **class-variance-authority** | 0.7.1 | 元件變體管理 |
| **clsx** | 2.1.1 | 條件式 className |
| **tailwind-merge** | 3.4.0 | TailwindCSS 類別合併 |
| **tailwindcss-animate** | 1.0.7 | 動畫擴充套件 |

### 1.3 Radix UI 元件

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

### 1.4 資料獲取與狀態

| 技術 | 版本 | 用途 |
|------|------|------|
| **SWR** | 2.3.8 | 資料獲取、快取、重新驗證 |
| **Firebase** | 10.12.0 | 客戶端 Firebase SDK |

### 1.5 監控與錯誤追蹤

| 技術 | 版本 | 用途 |
|------|------|------|
| **@sentry/nextjs** | 10.34.0 | 錯誤追蹤與效能監控 |

### 1.6 開發工具

| 技術 | 版本 | 用途 |
|------|------|------|
| **ESLint** | 8.57.0 | 程式碼品質檢查 |
| **eslint-config-next** | 16.1.4 | Next.js ESLint 配置 |
| **PostCSS** | 8.5.6 | CSS 後處理器 |
| **Autoprefixer** | 10.4.23 | CSS 前綴自動添加 |

---

## 2. 後端技術棧 (Firebase Functions)

### 2.1 核心框架

| 技術 | 版本 | 用途 |
|------|------|------|
| **Firebase Functions** | 7.0.3 | Serverless 函數框架 |
| **Firebase Admin** | 13.6.0 | 後端 Firebase SDK |
| **Node.js** | 20 | JavaScript 執行環境 |
| **TypeScript** | 5.7.2 | 靜態類型檢查 |

### 2.2 Google Cloud 服務

| 技術 | 版本 | 用途 |
|------|------|------|
| **@google-cloud/secret-manager** | 5.6.0 | 密鑰管理 |
| **@google-cloud/tasks** | 6.2.1 | 雲端任務佇列 |
| **@google/generative-ai** | 0.24.1 | Gemini AI API |

### 2.3 第三方整合

| 技術 | 版本 | 用途 |
|------|------|------|
| **@notionhq/client** | 2.2.15 | Notion API 客戶端 |

### 2.4 資料驗證

| 技術 | 版本 | 用途 |
|------|------|------|
| **Zod** | 4.3.5 | Schema 驗證與類型推導 |

### 2.5 開發與測試

| 技術 | 版本 | 用途 |
|------|------|------|
| **Jest** | 29.7.0 | 單元測試框架 |
| **ts-jest** | 29.2.5 | Jest TypeScript 支援 |
| **ESLint** | 8.57.1 | 程式碼品質 |
| **@typescript-eslint/parser** | 8.19.0 | TypeScript ESLint 解析 |
| **firebase-functions-test** | 3.3.0 | Functions 測試工具 |

---

## 3. 微服務技術棧

### 3.1 AI Gateway

| 技術 | 版本 | 用途 |
|------|------|------|
| **Express** | 4.18.2 | Web 框架 |
| **@google/generative-ai** | 0.21.0 | Gemini AI API |
| **@google-cloud/secret-manager** | 5.0.0 | 密鑰管理 |
| **cors** | 2.8.5 | 跨域支援 |

### 3.2 共用技術

所有微服務共用:
- **TypeScript** - 類型安全
- **Docker** - 容器化
- **Cloud Run** - 部署平台

---

## 4. 雲端基礎設施

### 4.1 Google Cloud Platform (GCP)

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

### 4.2 Firebase

| 服務 | 用途 |
|------|------|
| **Firebase Authentication** | 使用者認證 |
| **Firestore** | 即時資料庫 |
| **Firebase Hosting** | 靜態內容託管 |

### 4.3 Vercel

| 服務 | 用途 |
|------|------|
| **Vercel Platform** | 前端部署與 CDN |
| **Edge Functions** | 邊緣運算 |

---

## 5. 開發工具鏈

### 5.1 版本控制

| 工具 | 用途 |
|------|------|
| **Git** | 版本控制 |
| **GitHub** | 程式碼託管 |
| **GitHub Actions** | CI/CD |

### 5.2 程式碼品質

| 工具 | 用途 |
|------|------|
| **ESLint** | JavaScript/TypeScript Linting |
| **Prettier** | 程式碼格式化 |
| **TypeScript** | 靜態類型檢查 |

### 5.3 測試

| 工具 | 用途 |
|------|------|
| **Jest** | 單元測試 |
| **Firebase Emulator** | 本地開發測試 |

---

## 6. 技術棧版本總覽

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
