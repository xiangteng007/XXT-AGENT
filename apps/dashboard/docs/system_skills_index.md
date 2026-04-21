# XXT-AGENT 系統第三方技能總索引表 (System Skills Index)

為因應 v2.0 系統重構、多代理人 (Multi-Agent) 視覺化渲染，以及 Argus 自治爬蟲模組擴張，我們於 2026-04-17 從全球開源 AI 代理技能庫 ([skills.sh](https://skills.sh/)) 匯入了以下 5 套具有最高權威認證 (Vercel, Google Labs 等) 的專業開發技能包 (Skills)。

這些技能已儲存於本機 `.agents/skills/` 或是全域技能庫中，未來的 Agent 在進行代碼重構或設計 UI 時，將會預設查閱這些知識。

---

## 🎨 視覺與前端框架類 (UI/UX & Frontend Frameworks)

### 1. Next.js 最佳實踐 (`next-best-practices`)
- **來源**: `vercel-labs/next-skills`
- **用途**: 指導 Agent 在構寫「戰情室對話視窗」與「NAS 硬體控制台」時，正確使用 App Router 伺服器渲染 (`Server Components`)、資料快取 (`Next Cache`) 與表單狀態管理機制 (`useActionState` 等)。
- **安全等級**: 絕對安全，純理論與程式碼規範指引。

### 2. 響應式與無障礙網頁設計規範 (`web-design-guidelines`)
- **來源**: `vercel-labs/agent-skills`
- **用途**: 確保 Titan, Lumi, Rusty, Nova 的專屬身分屬性面板在各尺寸的裝置上 (手機/平板/曲面螢幕) 配置不會走樣，且符合企業級 A11y 盲人閱讀器操作標準。
- **安全等級**: 絕對安全。

### 3. Tailwind V4 設計系統接管 (`tailwind-design-system`)
- **來源**: `wshobson/agents`
- **用途**: 將本專案的 `Carbon Copper` 賽博工業風 (深黑、銅棕、亮橘配色) 透過這套技能包，由 Agent 自動套用與重構現有的 Tailwind CSS 類別，避免亂塞 style 屬性。
- **安全等級**: 絕對安全。

### 4. Stitch React 物件庫整合 (`react:components`)
- **來源**: `google-labs-code/stitch-skills`
- **用途**: 教導系統利用我們預裝的 Google StitchMCP 加上此技能包，自動建構高質感的 React 元件 (如 3D 玩偶視角展示卡、動態數據圖表等)。
- **安全等級**: 絕對安全。

---

## 🕸️ 系統後端與自治情報類 (System Backend & Autonomous OSINT)

### 5. Playwright 無頭爬蟲高級戰術 (`playwright-best-practices`)
- **來源**: `currents-dev/playwright-best-practices-skill`
- **用途**: 此為 Argus 情報長 **專屬** 的技能升級。寫出來的佈署腳本能夠實作「反向代理 (Proxy Rotation)」、「防封鎖機制 (Anti-Bot Bypass)」。
- **安全等級**: 綠色 (需配合 Docker 執行爬蟲，防範資源洩漏)。

## 🧠 多代理與高階記憶架構 (Multi-Agent & RAG / Animation)

### 6. 多代理人對話攔截與指揮 (`multi-agent-patterns`)
- **來源**: `XXT-AGENT 核心進階戰略`
- **用途**: 實作 Supervisor 主管層級。當代理人 (Argus, Titan) 在戰情室無止盡爭吵時，由程式碼進行狀態機節點攔截，防止 Token 爆量。

### 7. 混合式向量搜索與 RAG (`rag-implementation`)
- **來源**: `XXT-AGENT 核心進階戰略`
- **用途**: 針對 ASUSTOR NAS 內的 ChromaDB 進行最佳化，教導大腦結合 Sparse Keyword 與 Dense Vector 進行超精準的情境記憶調取。

### 8. 程式化動態 UI 動畫演算 (`programmatic-animation`)
- **來源**: `XXT-AGENT 核心進階戰略` (基於 Framer/Remotion 原理)
- **用途**: 教首代碼實作物理等級的彈簧特效與警報過場。賦予接下來 2D 視覺化代理人「生命力」。

---

*紀錄生成版本：XXT-AGENT Core v8.0.0*
*建檔者：Antigravity (System AI Agent)*
