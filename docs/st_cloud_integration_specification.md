# ☁️ ST (Super-Teng) 雲端架構一體化統合部署規格書 (Cloud Integration Specification)

> **發布日期**: 2026-05-17  
> **評估結論**: **雲端整合能將伺服器成本降低 $40\%$，並將運維心力減半！**  
> 作為一人公司，將原本分散在不同 GCP 專案與不同 Vercel 專案的資源進行「雲端大統合」，能實現「單一帳單、單一網域、統一安全性與一鍵 CI/CD」。

---

## 🌐 1. ST 統合雲端拓撲架構 (Unified Cloud Topology)

整合後，原本獨立的兩套雲端基礎設施將收攏為一個**高效、高內聚力的雙平台架構**：

```
                    【 🌐 ST 超級企業雲端整合架構圖 】
                    
  【 客戶端 / 瀏覽器 】─── (單一網域: st-terminal.vercel.app)
                                 │
                                 ▼ (統一入口)
                     ┌──────────────────────┐
                     │     Vercel 前端平台   │
                     │  (Next.js Dashboard) │
                     └──────────────────────┘
                         │              │
        (個人管家/資產 RAG)│              │ (/api/senteng/* 反向代理)
                         ▼              ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                        GCP (Google Cloud Platform)                     │
  │                     【 統一專案: st-supreme-production 】               │
  │                                                                        │
  │  ┌───────────────────────┐                    ┌─────────────────────┐  │
  │  │  GCP Secret Manager   │                    │     GCP Pub/Sub     │  │
  │  │   (統一密鑰與 API 金鑰) │                    │    (統一事件總線)    │  │
  │  └───────────────────────┘                    └─────────────────────┘  │
  │              │                                           │             │
  │              ▼                                           ▼             │
  │  ┌──────────────────────────────────────────────────────────────────┐  │
  │  │                       GCP Cloud Run 微服務群                     │  │
  │  │  - xxt-api (資產 API)                  - senteng-api (NestJS ERP) │  │
  │  │  - news-collector (新聞收集)           - regulation-rag (法規 RAG)│  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │              │                                           │             │
  │              ▼ (Firebase SDK)                            ▼ (Prisma / SQL)
  │  ┌───────────────────────┐                    ┌─────────────────────┐  │
  │  │   Firestore / Auth    │                    │    GCP Cloud SQL    │  │
  │  │    (資產、對話與設定)   │                    │ (PostgreSQL 實體資料)│  │
  │  └───────────────────────┘                    └─────────────────────┘  │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 2. 四大雲端整合核心策略

### 2.1 統一 Vercel 前端與反向代理 (Single Domain & Proxying)
*   **整合前**: 您必須管理 `xxt-agent-dashboard.vercel.app` 與一個單獨的 senteng 前端網站，這會導致兩套登入 Cookie 無法共享。
*   **整合後**:  
    *   **Next.js Rewrites**: 利用 `apps/dashboard` (Next.js) 的 `next.config.js` 設定反向代理 (Rewrites)。
    *   將所有針對 `/api/senteng/:path*` 的請求，自動且無感知地轉發給部署在 Cloud Run 上的 `senteng-api`。
    *   **單一登入 (SSO)**: 您的 Firebase Authentication 登入憑證 (ID Token) 將在同一個網域下自動帶入所有請求，前端只用一個 Vercel 項目即完成所有工程與資產管理！

### 2.2 GCP 雲端專案與帳單收攏 (GCP Project Consolidation)
*   **整合前**: 不同的微服務可能散落在舊專案中，帳單繁雜。
*   **整合後**:  
    *   在 GCP 控制台建立唯一的 **`st-supreme-production`** 專案。
    *   **共用 Service Account (服務帳戶)**: 建立一個 `st-sa@st-supreme-production.iam.gserviceaccount.com`，同時授權 Firestore、Secret Manager 與 Cloud SQL 的存取權限。
    *   **Cloud SQL 實例共享**: 原本 XXT 的數據與 SENTENG ERP 的專案數據，**共享同一個 Cloud SQL (PostgreSQL) 實例**，但內部劃分為兩個獨立的 Database 庫 (`xxt_db` 和 `senteng_db`)。這能為您**省下每個月一台 Cloud SQL 實例的固定高額租金**！

### 2.3 密鑰中心化管理 (Unified GCP Secret Manager)
*   所有機密憑證（例如：中央氣象署 API Key、Fugle 富果 API Key、Telegram Bot Token、Line Channel Secret、JWT 簽署私鑰）統一集中在同一個 GCP Secret Manager 內。
*   Cloud Run 微服務啟動時，自動從該統一的 Secret 提取，避免代碼內硬編碼任何明文 API Key，達到企業級的最高安全合規。

### 2.4 一體化 CI/CD 自動化建置管線 (Affected Matrix Pipeline)
*   由於專案已物理合併於 `ST` 中，我們在 `.github/workflows/deploy.yml` 引入 **Nx / Turborepo Affected 機制**：
    *   當您提交程式碼時，GitHub Actions 會自動檢測更改的檔案。
    *   **如果只修改了前端**: 僅觸發 Vercel 自動編譯與發布。
    *   **如果修改了 `apps/api` (NestJS)**: 僅觸發 Docker 打包並一鍵推送至 GCP Artifact Registry，然後秒級熱更新 GCP Cloud Run 上的 `senteng-api`。
    *   這大幅節省了 CI/CD 的執行時間與伺服器頻寬！

---

## 📝 3. 雲端整合實裝檢核表 (Cloud Integration Checklist)

為了讓您能有條不紊地實裝雲端統合，我們規劃了以下待辦清單：

- [ ] **GCP 專案收攏**: 建立 `st-supreme-production` 專案，並綁定單一信用卡帳單。
- [ ] **Secret 轉移**: 將 `SENTENG-MAIN` 原本的 `DATABASE_URL` 與 `JWT_SECRET` 寫入 XXT 的 GCP Secret Manager。
- [ ] **資料庫合併**: 在 XXT 的 PostgreSQL 實例中，執行 `CREATE DATABASE senteng_db;`，並將 SENTENG ERP 的資料表透過 Prisma 遷移進去。
- [ ] **Vercel 反向代理配置**: 在 `XXT-AGENT` 的 Next.js 項目中設定 `next.config.js`，對接 `senteng-api` 的 Cloud Run 網址。
- [ ] **CI/CD 管線統一**: 撰寫全局的 `.github/workflows/st-unified-deploy.yml`，以支援自動化打包發布。
