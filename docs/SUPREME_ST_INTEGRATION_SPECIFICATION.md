# 🛸 ST (Super-Teng) 雙系統架構大統合、UI 重構與混合 AI 協作規劃書 (Supreme ST Integration Specification)

> **發布日期**: 2026-05-17  
> **核心目標**: 融合 `XXT-AGENT` 與 `SENTENG-MAIN` 的架構理念，打造一個**記憶庫完全在 NAS、大部分任務本地運轉、無須開啟 Antigravity 視窗即可獨立執行，並在必要時透過 API 協作調用 Google AI Ultra 級模型**的超級智能底座。

---

## 🏛️ 1. 技術棧與架構理念大統合 (Unified Tech Stack & Architecture)

我們將 `SENTENG-MAIN` 的 Nx Monorepo 高內聚架構，與 `XXT-AGENT` 的 LangGraph 智能代理深度結合，在 **`C:\Users\xiang\ST`** 內實施如下技術統合：

```
                              【 🏛️ ST 雙系統架構大統合圖 】
                              
         【 前端展示面 (Vite 7 + Next.js) 】          【 本地運算與大腦面 (Workstation) 】
         ┌──────────────────────────────┐          ┌─────────────────────────────┐
         │     Carbon Copper V5 UI      │          │    Ollama - Qwen2.5 (本地)  │
         │  (玻璃擬態 + 金絲銅邊框 Dashboard)  │          │    (RTX 4080 SUPER 算力)    │
         └──────────────────────────────┘          └─────────────────────────────┘
                        │                                         │
                        ▼ (反向代理 /api/senteng)                   ▼ (高效儲存與向量檢索)
  ┌───────────────────────────────────────────────────────────────────────────────┐
  │                           本地 NAS 資料儲存與記憶庫 (QNAP NAS)                 │
  │                                                                               │
  │  ┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐  │
  │  │  ChromaDB / Qdrant   │  │   PostgreSQL 數據庫   │  │    MinIO 對象存儲   │  │
  │  │   (向量長短期記憶)    │  │  (營建/財務/交易實體)  │  │   (合約與合規 PDF)   │  │
  │  └──────────────────────┘  └──────────────────────┘  └─────────────────────┘  │
  └───────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 核心架構理念
*   **Nx Monorepo 模組化解耦**:  
    ST 專案統一採用 Nx 管理。`apps/dashboard` 作為單一前端入口，`apps/api` (NestJS 11 + Prisma ORM) 作為實體業務核心，`services/investment-brain` 作為 AI 代理模組，`libs/shared` 共享 Zod 型別校驗。
*   **本地記憶庫 100% 落地 QNAP NAS**:  
    *   **結構化數據**: 統一儲存於 NAS PostgreSQL (`senteng_db` 與 `xxt_db`)。
    *   **非結構化記憶 (RAG)**: 部署於 NAS Docker 的 ChromaDB/Qdrant。
    *   **多媒體與合約文件**: 儲存於 NAS MinIO，杜絕任何雲端數據隱私洩露風險。

---

## 🌐 2. 混合型 AI 協作引擎與獨立運行可行性分析 (Hybrid AI Collaboration)

您提出一個極具前瞻性的構想：**「記憶庫在本地 NAS，大部分任務使用本地模型，且能不透過開啟 Antigravity 視窗即可獨立運行，同時可與 Google AI Ultra 級別的模型做 API 協作。」**

### 2.1 可行性評估：100% 絕對可行！
這個架構**完全不需要開啟 Antigravity (VS Code AI 代理編輯會話) 即可獨立且永久運行**。原因如下：
1.  **運行載體**: 本地大腦（`investment-brain` / `st-gateway`）是基於 Python FastAPI 與 NestJS 的背景守護進程 (Daemon)。它透過 **Windows 服務**、**PM2** 或 **NAS Docker** 持續在後台執行。
2.  **Google AI 協作途徑**: 我們無需透過這個 VS Code 聊天視窗。本地服務可以直接調用官方的 **`@google/generative-ai` SDK**，只需要在本地的 `.env` 檔案中配置您個人的 **Google AI Studio API Key**，即可在背景以極高速度直接調用 Gemini 1.5 Pro / Ultra 級別的模型！

### 2.2 混合協作決策邏輯 (Hybrid Orchestrator)
我們在本地網關中設計一個 **「複雜度分流器 (Complexity Router)」**：
*   **高頻、隱私、低延遲任務**（如：每日市場 K 線特徵計算、日程排定、NAS 狀態監控、物料表單處理）👉 **100% 留在本地 RTX 4080 SUPER (Qwen2.5) 執行，0 雲端 API 成本**。
*   **高複雜度、超長上下文任務**（如：50 頁營建安衛計畫書法律合規審查、複雜多 Agent 代碼重構、宏觀經濟跨季預測）👉 **自動封裝 Context，透過 API 金鑰發送給 Google Gemini 1.5 Pro (Google AI Ultra 級別) 進行協作**。

#### 💻 本地混合協作代碼藍圖 (Complexity Router Blueprint)
```python
# C:\Users\xiang\ST\services\investment-brain\src\brain\hybrid_orchestrator.py
import os
import httpx
from typing import Any, Dict
from google import generativeai as genai

class HybridBrainOrchestrator:
    """本地與 Google AI 混合協作引擎 (不依賴 VS Code 開啟即可運行)"""
    
    def __init__(self):
        self.local_ollama_url = "http://localhost:11434/api/chat"
        # 直接讀取本地環境變數中的 Google AI Studio API Key
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        if self.gemini_api_key:
            genai.configure(api_key=self.gemini_api_key)

    async def execute_task(self, prompt: str, domain: str, complexity: str = "low") -> str:
        # 1. 判斷複雜度：如果屬於超長文本或法規審查，且配置了 API Key，則調用雲端 Gemini
        if complexity == "high" and self.gemini_api_key:
            return await self._call_gemini_ultra(prompt)
        
        # 2. 否則，100% 留在本地 RTX 4080 運作
        return await self._call_local_qwen(prompt)

    async def _call_local_qwen(self, prompt: str) -> str:
        payload = {
            "model": "qwen2.5-ST-brain",
            "messages": [{"role": "user", "content": prompt}],
            "stream": False
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(self.local_ollama_url, json=payload, timeout=60.0)
            return resp.json()["message"]["content"]

    async def _call_gemini_ultra(self, prompt: str) -> str:
        # 使用 Google 頂級 Gemini 1.5 Pro 模型協作
        model = genai.GenerativeModel('gemini-1.5-pro')
        response = model.generate_content(prompt)
        return response.text
```

---

## 🎨 3. 統合後的前端 UI 重構規劃 (Carbon Copper V5 Redesign)

在雙系統實體代碼與資料庫大統合完成後，我們將對前端進行徹底的**視覺與交互重構**。

### 3.1 設計語言：Carbon Copper V5 + 玻璃擬態 (Carbon Black Glassmorphism)
為了一個人公司的高端儀表板體驗，重構後的 UI 將採用極具質感的**工業賽博龐克微光視覺**：
*   **主色調 (Base Canvas)**: 採用接近純黑但帶有磨砂質感的深碳黑 `#0a0b0d`。
*   **輔助色 (Accents)**: 以暖色調的**亮銅金 `#d4af37`** 與**拉絲古銅色 `#c87d55`** 作為邊框與發光特效。
*   **玻璃擬態 (Backdrop Blur)**: 卡片組件採用 `backdrop-blur-md bg-opacity-30 bg-black border border-copper/10`，呈現半透明懸浮質感。

### 3.2 統合後的單頁面路由佈局 (Sitemap)

```
       ┌────────────────────────────────────────────────────────┐
       │  [ST CONTROL TOWER]            創辦人: Teng 📊  [設定]  │ (Top Bar)
       ├──────────────┬─────────────────────────────────────────┤
       │ 📂 智能大腦  │ 【 🧠 ST 智能控制中樞 (快環控制台) 】     │
       │   - AI 對話  │                                         │
       │   - 進化日誌 │  Ollama 狀態: 🟢 在線 (RTX 4080 SUPER)  │
       │              │  NAS 儲存容量: 42.8 TB (可用)            │
       │ 🏗️ 營建工程  │                                         │
       │   - 工程看板 │ ┌───────────────────┐ ┌────────────────┐│
       │   - 預算估估 │ │  💡 投資決策預警   │ │ 🪵 營建安衛計畫││
       │   - 合約法規 │ │  - TSLA 目標價突破 │ │ - CNS 規範無誤 ││
       │              │ └───────────────────┘ └────────────────┘│
       │ 🚗 生活管家  │                                         │
       │   - 每日行程 │ 【 📊 全域商業 CRM 與財務看板 】        │
       │   - 車輛定保 │                                         │
       │              │ 應收工程款: NT$ 1,280,000  (Partners)   │
       └──────────────┴─────────────────────────────────────────┘
```

---

## 📅 4. 實裝進度路線圖與里程碑 (Roadmap Gates)

*   **Gate 1**: 執行 PowerShell 物理遷移，將代碼統一併入 `ST` 資料夾下，並修復 `senteng-oneclick` 腳本。
*   **Gate 2**: 在本地 NAS Docker 啟動 ChromaDB 與 PostgreSQL 資料庫雙向合併。
*   **Gate 3**: 部署 `hybrid_orchestrator.py` 並在 `.env` 配置 Google AI Studio 密鑰，完成**不開 Antigravity 即可獨立背景運行**的混合 AI 測試。
*   **Gate 4**: 執行前端大重構，將 SENTENG 與 XXT 路由完美合併於 **Carbon Copper V5** 玻璃擬態儀表板中。

---

> [!IMPORTANT]
> **🌟 本計畫書的長遠價值**: 本計畫已正式寫入您的 **`C:\Users\xiang\ST`** 中。它將作為您 ST 超級專案最核心的「架構終極白皮書」，為您的本地算力、NAS 存儲與 Google AI 頂級大模型之間搭建出一條無懈可擊的一體化通道！
