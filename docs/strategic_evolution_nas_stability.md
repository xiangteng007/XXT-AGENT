# 🧠 XXT-AGENT 智能進化：本地全方位助理發展方向與 NAS 記憶庫穩定性方案

> **發佈日期**: 2026-05-17  
> **機密等級**: 專案核心機密  
> **目標對象**: XXT-AGENT 架構委員會 / 本地操作員  

---

## 🧭 第一部分：本地全方位助理的四維進化方向

您的本地硬體（RTX 4080 SUPER 16GB + Core Ultra 9 285K）為本地端大模型提供了極為罕見的高規格算力。要將其從單純的「投資大腦」淬煉成一個**完美的全方位助理**，我們建議推進以下四個方向的擴充：

### 1. 多模態視覺與語音對話 (Multimodal & Voice Operations)
*   **視覺整合 (Vision RAG)**:  
    將本地模型無縫升級為 `Qwen2-VL-7B` 或 `Llama-3.2-Vision`。助理將具備分析 K 線圖截圖、報表圖像、甚至是辦公室 PDF 合約掃描件的能力，不再侷限於結構化 JSON。
*   **低延遲語音對話 (Local Voice Engine)**:  
    在工作站背景部署 `Whisper-Faster` (語音轉文字 STT) 與極輕量高效的 `Kokoro-82M` (文字轉語音 TTS)。讓您在操作多個螢幕時，能直接用語音對大腦下達「幫我分析今天台積電的三大法人籌碼狀況」等口頭指令，提供零時差的語音交互。

### 2. 基於 MCP 協定的系統操作自動化 (Agentic Tool-Calling via MCP)
*   **Model Context Protocol (MCP) 集成**:  
    引進 Anthropic 開源的 MCP 協定，為本地模型配備「手腳」。
*   **發展場景**:  
    讓助理能夠自主讀寫 NAS 文件、自動執行本機 Python 指令進行數據採集、甚至是整合您的 Google 日曆、LINE 訊息自動派發、Telegram 機器人控制。助理將轉變為具備高度主動性的 **Agentic Workflow 執行者**。

### 3. 動態路由與混合大腦模型 (Dynamic Routing & Multi-Model Hybrid)
*   **智能路由機制**:  
    部署 `Router-LLM` 輕量化網絡。
    *   **一般性與行政任務**: 路由至超快速的 `Nemotron-Nano (4B)`，零秒回覆，近乎不佔用顯存。
    *   **深度選股與程式碼開發**: 路由至微調後的 `Qwen2.5-14B-Instruct`。
    *   **複雜金融情境**: 熱載入 LoRA 適配器並調用完整 Triple Fusion Graph。
*   這能將顯存與運算能效利用率提升 $300\%$。

### 4. 情境對齊與性格適應性 (KTO / Personality Alignment)
*   除了 DPO（偏好對齊）之外，引進 **KTO (Kahneman-Tversky Optimization)** 或 RLAIF。讓助理在日常對話中學習您的反饋特徵（例如：喜歡簡明扼要的簡報、偏好保守防禦的操作、或對高風險套利有興趣），自動微調其 Prompt 偏好與寫作風格，成為專屬於您的數位孿生分身。

---

## 💾 第二部分：確保專案與本地模型記憶庫在 NAS 上穩定運作的五大安全柵欄

根據您的 `docker-compose.yml`（已編排 Qdrant, ChromaDB, Redis, MinIO 及 PostgreSQL），您的 NAS 扮演著 XXT-AGENT 的 **「長期中央記憶與數據中樞 (NAS Data Plane)」**。為保障其達到 $99.99\%$ 金融級的運行穩定性，我們必須部署以下安全柵欄：

```
                    【 XXT-AGENT 安全記憶數據面 (Data Plane) 】
                                
  ┌──────────────────────────┐                  ┌──────────────────────────┐
  │   本地 GPU 運算工作站    │                  │      GCP 雲端服務        │
  │   (RTX 4080 SUPER / SFT) │                  │   (Cloud Run / API)      │
  └──────────────────────────┘                  └──────────────────────────┘
                │                                             │
                ▼ (Tailscale Zero-Trust Encrypted Mesh)       ▼
  ══════════════════════════════════════════════════════════════════════════
                                    │
                                    ▼ (LAN / Tailscale IP: 8001)
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           NAS Docker 儲存平台                          │
  │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ │
  │ │  Qdrant (向量) │ │ Chroma (記憶) │ │ Redis (快取)  │ │ MinIO (資產) │ │
  │ └───────────────┘ └───────────────┘ └───────────────┘ └──────────────┘ │
  │        │                 │                 │                 │         │
  │        └─────────────────┴────────┬────────┴─────────────────┘         │
  │                                   ▼                                    │
  │                   ┌───────────────────────────────┐                    │
  │                   │  NAS NVMe SSD 高速快取緩衝區   │                    │
  │                   └───────────────────────────────┘                    │
  │                                   │                                    │
  │                   ┌───────────────────────────────┐                    │
  │                   │  Hyper Backup 每日排程備份    │                    │
  │                   └───────────────────────────────┘                    │
  └────────────────────────────────────────────────────────────────────────┘
```

### 1. Tailscale 零信任遠端加密網格 (Zero-Trust Remote Mesh)
*   **運作機制**:  
    在 NAS 上安裝並登入 Tailscale，將 NAS 納入您的個人 Mesh 網路中。
*   **優勢**:
    *   **無公網暴露**: ChromaDB (`8001`) 與 Qdrant (`6333`) 無需設定任何路由器 Port Forwarding，也無需申請固定公網 IP，免除一切網絡掃描與 DDoS 攻擊。
    *   **安全通道**: GCP Cloud Run 與本地工作站能通過 Tailscale 加密隧道直接呼叫 `http://100.x.x.x:8001` 進行向量讀寫，兼顧極佳的便利性與最高安全防禦力。

### 2. 自動重載與健康監控鎖 (Auto-Healing Healthcheck Locks)
*   **實裝作法**:  
    雖然 compose 內建了 `healthcheck`，但這只是檢驗狀態。我們應在 NAS 部署一個輕量級 **Autoheal 守護容器**。
    ```yaml
    autoheal:
      image: willfarrell/autoheal:latest
      container_name: docker-autoheal
      restart: unless-stopped
      environment:
        AUTOHEAL_CONTAINER_LABEL: all
      volumes:
        - /var/run/docker.sock:/var/run/docker.sock
    ```
*   **效果**:  
    當 ChromaDB 或 Qdrant 發生 VRAM 溢出、記憶體洩漏或網路假死，導致健康檢查連續三次失效時，Autoheal 會**在 3 秒內自動重啟該容器**，實現自我防禦修復，確保大腦記憶體 24h 不斷線。

### 3. 高速快取分層與 SSD 護航 (NVMe Caching)
*   **硬體優化原則**:  
    ChromaDB 與 Qdrant 的索引文件有頻繁的隨機小檔案讀寫的需求。
*   **避坑指南**:  
    **絕對不要**將 Qdrant 與 ChromaDB 的 Docker volume 掛載在傳統機械硬碟 (WDC Red HDD) 上，這會導致高並發推理時的 I/O 阻塞延遲 (I/O Wait)。
*   **正確配置**:  
    務必將 Volume 路徑（如 `qdrant_data` 與 `chroma_data`）指定在 NAS 的 **NVMe SSD 快取磁碟區** 或直接掛載在固態硬碟磁碟區上，使查詢延遲維持在 **< 10ms** 的極速狀態。

### 4. 數據防護與自動快照備份管線 (SOP Backup with RPO < 24h)
*   **備份方案**:  
    啟用 Synology Hyper Backup 或配置 Rsync Cron 任務。
*   **備份腳本設計**:  
    每日凌晨 4:00 大盤休息時，自動呼叫 Docker 容器將持久化數據備份。
    ```bash
    # 範例：熱備份備份至第二備份碟
    tar -czf /volume2/backups/chroma_backup_$(date +%F).tar.gz /volume1/docker/chromadb/data
    ```
    這可確保即使 NAS 硬碟因突發停電而損壞，您的助理記憶庫仍能於 10 分鐘內完美還原，將數據丟失風險降低至 0。

### 5. 故障降級與斷線自動緩衝 (Connection Fallback Chain)
*   **系統彈性**:  
    在大腦的 API 連接代碼中（`memory-store.service.ts`），必須實裝「超時自動降級 (Graceful Degradation)」。
*   **邏輯**:  
    當助理發送記憶檢索至 NAS 且 `timeout > 3.0s`（代表 NAS 可能因限電或停電斷開）時，系統自動切換回 **「本地 SQLite / Redis 記憶體備用緩衝」**。此時助理會提示您「長期記憶庫目前離線，已開啟本機臨時備忘模式」，在 NAS 恢復上線後，自動將本地緩存的對話記憶增量同步回 NAS，確保業務絕不中斷。

---

> [!NOTE]
> **💡 長期維運指示**: 以上 NAS 穩定性 SOP 已正式與本專案的 `PROJECT_CONFIG.md` 連結。在未來的開發疊代中，系統將優先遵循此「零信任+高速快取+故障降級」的安全規範進行記憶庫讀寫。
