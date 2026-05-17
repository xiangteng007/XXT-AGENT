# 🌐 ST (Super-Teng) 超級企業雲端服務大統合終極計畫書 (Supreme Cloud Integration Plan)

> **發布日期**: 2026-05-17  
> **編制目的**: 針對「一人公司」營運模式，將 GitHub、Firebase、Vercel、GCP、Cloudflare、Tailscale、LINE 創作者平台、Telegram 機器人等**所有雲端服務進行 100% 物理與帳號層級的深度整合**，打造堅不可摧的單人企業級數位堡壘。

---

## 🗺️ 全局雲端統合架構與帳務視圖 (Unified Billing & Auth View)

```
                            【 🛡️ ST 全域雲端帳務與認證中樞 】
                            
       (統一身分驗證 SSO)          (統一版本與流水線)          (統一域名與 DNS 防禦)
     ┌───────────────────┐       ┌──────────────────┐       ┌──────────────────┐
     │   Firebase Auth   │       │   GitHub ST Org  │       │  Cloudflare Pro  │
     │  (Google / OAuth)  │       │  (單一 Monorepo)  │       │ (DNS, WAF, Tunnel)│
     └───────────────────┘       └──────────────────┘       └──────────────────┘
               │                          │                          │
               ▼                          ▼                          ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │                            GCP 生產級單一專案                              │
  │                  【 st-supreme-production 】(單一信用卡帳單)                 │
  │                                                                            │
  │  ┌─────────────────┐   ┌───────────────────┐   ┌────────────────────────┐  │
  │  │   Cloud Run     │   │  Secret Manager   │   │  Cloud SQL / Firebase  │  │
  │  │ (所有微服務群)   │   │  (全局金鑰保險箱)  │   │  (Postgres & NoSQL)    │  │
  │  └─────────────────┘   └───────────────────┘   └────────────────────────┘  │
  └────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 第一部分：各大雲端服務統合方案與路徑表 (The Integration Blueprint)

### 1. GitHub 統合方案 ─ 統一倉庫與 CI/CD 機制 (Repository & Actions)
*   **目標**: 結束多倉庫碎片化狀態，將所有代碼、工作流程（workflows）與 Issues 收攏至單一核心倉庫。
*   **整合方案**:
    *   **統一倉庫**: 建立全新的私有倉庫 **`xiangteng007/ST-SUPREME`**。
    *   **物理移入**: 將 `XXT-AGENT`、`SENTENG-MAIN`、`SENTENG-TELEGRAMBOT` 與 `senteng-oneclick` 物理移動為該 Monorepo 的子目錄。
    *   **統一 GitHub Actions (CI/CD)**:  
        在 `.github/workflows/` 下建立一個 **Matrix Build Pipeline (矩陣部署流水線)**。利用 `nx affected` 或 `turborepo` 自動檢測代碼變更。只對有修改的服務執行測試、Docker 打包、並自動推送至 GCP Artifact Registry，杜絕重複編譯，大幅省下 GitHub Actions 額度。
    *   **專案看板 (Projects)**: 啟用 GitHub Projects v2，建立一個單一的 Kanban 板，同時追蹤「投資大腦優化」、「生活管家提醒」與「實體營造工程施工進度」的任務 Backlog。

---

### 2. Firebase / Firestore 統合方案 ─ 統一身分與快取數據面 (Auth & NoSQL)
*   **目標**: 統一前後端的用戶資料庫，達成一次登入、全站通行，並共享即時快取。
*   **整合方案**:
    *   **單一 Firebase 專案**: 啟用唯一的生產級專案 **`st-supreme-prod`**。
    *   **統一身分驗證 (SSO)**:  
        使用 Firebase Auth (Google OAuth 2.0)，綁定您做為「創辦人/管理員」的唯一 Google 帳號。無論是登入資產大腦，還是進入工程管理後台，皆使用同一個 JWT (JSON Web Token) 進行身份校驗。
    *   **Firestore 集合結構化隔離**:  
        在同一個 Firestore 資料庫中，使用「命名空間 (Namespace)」隔離不同的業務數據：
        *   `users/` - 統一用戶角色（Admin, Contractor, Partner）與 RBAC 權限。
        *   `xxt_regimes/` - 投資大腦的情境數據與策略狀態。
        *   `senteng_construction/` - 實體工程專案進度與協力商清單快取。
    *   這免去了維護兩套 Firebase Config 的麻煩，並將 Firebase 免費額度合併發揮最大效能。

---

### 3. Vercel 統合方案 ─ 單一域名與邊緣計算路由 (Vercel & Domain Engine)
*   **目標**: 將所有網頁應用合併到一個 Vercel 項目與單一自訂網域下，避免跨網域 Cookie 與 CORS 阻擋。
*   **整合方案**:
    *   **單一 Vercel 專案**: 建立一個名為 `st-supreme-platform` 的 Vercel 專案，直接連結 GitHub 單一倉庫的 `ST/XXT-AGENT/apps/dashboard`。
    *   **邊緣反向代理 (Rewrites)**:  
        在 Next.js 的 `next.config.js` 中實裝 Rewrites 代理：
        ```javascript
        module.exports = {
          async rewrites() {
            return [
              {
                source: '/api/senteng/:path*',
                destination: 'https://senteng-api-st-supreme.run.app/api/:path*'
              }
            ]
          }
        }
        ```
    *   **自訂網域 (Custom Domain)**: 綁定如 `st-terminal.xyz` (或您的專屬網域)，全站的路由結構清晰呈現：
        *   `st-terminal.xyz/ai` -> 本地自學習大腦分析
        *   `st-terminal.xyz/butler` -> 個人生活與車輛管家
        *   `st-terminal.xyz/senteng` -> 實體營造工程與物料管理
        *   `st-terminal.xyz/api/senteng/*` -> 自動且安全地轉發給後端 NestJS。

---

### 4. Cloudflare 統合方案 ─ 統一域名 DNS、WAF 防禦與 NAS 穿透 (DNS & Tunnel)
*   **目標**: 保護雲端入口，並為本地 NAS 提供免 Port-Forwarding 的金融級安全穿透。
*   **整合方案**:
    *   **統一 Cloudflare DNS**:  
        將您的自訂網域託管在 Cloudflare，開啟 **Proxy (橘色雲朵)**，強制啟用 HTTPS (TLS 1.3) 與防掃描的 Web Application Firewall (WAF)。
    *   **Cloudflare Tunnels (本地 NAS 穿透)**:  
        在您的 QNAP NAS Docker 上部署 `cloudflared` 隧道容器。
        *   設定隧道將 `https://nas-api.st-terminal.xyz` 直接穿透對接本地的 Qdrant / ChromaDB 向量記憶庫，無需在實體路由器上開啟任何 Port 轉發，杜絕一切黑客掃描。

---

### 5. Tailscale 統合方案 ─ 零信任加密內網網格 (Tailnet Mesh)
*   **目標**: 為 GCP Cloud Run（雲端）與 RTX 4080 SUPER 本地算力站、NAS 提供一條高安全、低延遲的「虛擬專線」。
*   **整合方案**:
    *   **統一 Tailnet**: 將本地工作站、NAS 與 GCP VPC 網絡全部納入同一個 Tailscale 帳號下。
    *   **GCP VPC Egress + Tailscale Subnet Router**:  
        在本地 NAS 上開啟 Subnet Router，使雲端的 Cloud Run 可以通過加密的 WireGuard 協議直接向本地 NAS `100.x.x.x` 發送向量檢索請求。

---

### 6. LINE & Telegram 機器人開發平台統合 (Bot Integrations)
*   **目標**: 將雙平台的通訊與警報通知收攏至統一的後端處理器。
*   **整合方案**:
    *   **統一 Webhook 網關**:  
        不論是 LINE Bot 的出席簽到（LINE Developers Console），還是 Telegram Bot 的選股下指令，其 Webhook URL 一律指向 `st-terminal.xyz/api/events`。
    *   **後端分流器**: 後端網關解析 Event 來源後，分發給 `EngineeringAgent` (工程派工) 或 `AssetAgent` (資產變動)。

---

## 📅 第二部分：雲端統合實裝計劃時程表 (Implementation Phases)

為了讓您的一人公司平穩過渡，我們將整合計畫分為三個階段，您可以逐步實施：

```
【 🚀 ST 雲端一體化實裝時程 】
 
 📅 階段一：帳號與倉庫收攏 (第 1-3 天)
 ├─ [ ] 建立 GitHub `ST-SUPREME` 私有倉庫，完成本地代碼物理搬遷。
 ├─ [ ] 建立 GCP 唯一的 `st-supreme-production` 專案，完成帳單綁定。
 └─ [ ] 在 Firebase 建立統一專案 `st-supreme-prod`。
 
 📅 階段二：資料庫與金鑰移轉 (第 4-7 天)
 ├─ [ ] 合併 PostgreSQL 實例，導入 `senteng_db` 結構。
 ├─ [ ] 集中密鑰至 GCP Secret Manager，刪除所有代碼中的明文金鑰。
 └─ [ ] 配置 Cloudflare Tunnel 以安全穿透 NAS 向量資料庫。
 
 📅 階段三：路由代理與一鍵 CI/CD 上線 (第 8-10 天)
 ├─ [ ] 在 Vercel 上部署合併後的前端，配置 Next.js 反向代理路由。
 ├─ [ ] 測試並實裝 GitHub Actions Matrix Affected 自動化編譯與部署。
 └─ [ ] 實裝「市場物料 × 天氣預警 × 專案採購」的 Triple Fusion 大腦自動決策警報。
```

---

> [!TIP]
> **💡 長期維運建議**: 本統合計畫書已正式被寫入您的 **`C:\Users\xiang\ST`** 中。這份計畫書不僅可以指導未來的開發，亦是您未來如果聘請合夥人或擴展團隊時，最核心的系統架構白皮書。
