# XXT-AGENT — 跨域多實體智能代理人生態系 (v6.0)

XXT-AGENT 已經從單一的投資分析系統，進化為一個足以支撐 **7 個法人與自然人實體**、並由 **20 位專業 AI Agent** 組成的虛擬企業生態系。

本系統採用嚴格的 **CAVP 協議（Cross-Agent Verification Protocol）** 確保不同設計師、會計師、無人機飛手與合約管家之間的資料主權與隱私隔離。

## 🏛 核心架構：七實體大矩陣

為防堵 AI 幻覺，系統強制綁定每項業務操作至特定的法人實體：

*   `company`：無人機航拍主公司
*   `foundation`：全國性志願救難協會
*   `design`：空間設計與室內裝修公司
*   `build`：營建與工程管理公司
*   *及個人/家族資產 (`personal`, `family`) 與局部專案 (`reno`)*

## 🤖 專屬專家群 (Agent Roster)

系統由 20 位專攻不同領域的 Agent 進行多主體運作。
**各 Agent 皆具備「領域法規 RAG 知識庫」與「資料寫入主權」限制：**

| Agent (代號) | 職能定位 | 主權資料領域 (Sovereignty) | RAG 配備 |
|--------------|----------|--------------------------|----------|
| **Accountant** | 財務長 | 帳本 (Ledger) 寫入權 | 稅法、發票 |
| **Finance** (融鑫) | 投資與大額資產 | 房地產專案、貸款評估 | 房地合一稅 |
| **Lex** | 合約與法務總管 | 合約 (Contracts) | 智財、設計著作 |
| **Guardian** (安盾) | 風險與保險 | 保單 (Insurance) | 金管法規 |
| **Scout** | 無人機機隊調度 | 飛行日誌 (Missions) | 航空法規 |
| **Zora** | NGO 公關與勸募 | 捐款人 (Donations) | 公益勸募條例 |
| **Titan** | BIM 與結構技師 | 3D 碰撞檢查 | 建築技術規則 |
| **Lumi** | 空間與室內設計 | 裝修專案 | 建築裝修法規 |
| **Rusty** | 算量與估算師 | 材料與報價單 (BOM) | CNS 鋼筋標準 |

> **資安宣告 (CAVP Policy)**：若 Agent A 需要 Agent B 的資料，必須發送 QVP 請求，**嚴格禁止**越權查閱或捏造跨域報價單/合約。

## 🌉 系統底層架構

```mermaid
graph TD
    UI[Dashboards / Telegram Bot] -->|HTTP / WSS| Gateway[OpenClaw Gateway]
    
    subgraph OpenClaw V2 架構
        Gateway --> P[Privacy Router\n(PRIVATE/INTERNAL/PUBLIC)]
        P --> A[Audit Logger\n(Firestore 稽核追蹤)]
        A --> C[Circuit Breaker\n(Rate Limiting & 熔斷)]
        C --> M{LLM Router}
    end

    M -.->|雲端模型\n(Gemini 3.1 Pro/Claude 3.5)| Cloud[Cloud API]
    M -->|🔒 本地模型\n(Qwen3:14b / Nemotron)| Local[Ollama / GPU Node]
    
    Local <--> RAG[ChromaDB 法規向量庫]
    Local <--> Store[(Firestore / Redis Store)]
```

## 🚀 部署與啟動指南

### 環境需求
- Node.js 22+ / pnpm 9+
- Python 3.10+ (RAG 服務)
- Ollama (具備 16GB+ VRAM 以執行本地敏感推理)

### 啟動服務
```powershell
# 1. 安裝依賴
pnpm install

# 2. 啟動法規 RAG 向量服務
cd services/regulation-rag
python app.py

# 3. 啟動 OpenClaw Gateway (核心腦)
pnpm turbo dev --filter=@xxt-agent/openclaw-gateway

# 4. 啟動 Dashboard 前端
pnpm turbo dev --filter=@xxt-agent/dashboard
```

## 📜 治理文件
開發與維護者請務必遵守以下憲法與規範：
- [System Constitution (系統大憲章)](docs/SYSTEM_CONSTITUTION.md)
- [Query Verification Protocol (QVP 手冊)](docs/governance/qvp_protocol.md)
- [E2E 驗證流程 (CAVP CI)](apps/functions/tests/README.md)
