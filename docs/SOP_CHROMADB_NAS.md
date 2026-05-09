# NAS ChromaDB 長期記憶系統 — 部署 SOP

> **目標**: 在 NAS 上部署 ChromaDB Docker，作為 Agent 長期記憶儲存  
> **前置條件**: NAS 支援 Docker (Synology/QNAP)、Tailscale 或 LAN 存取  
> **Port 規範**: Host `8001` → Container `8000` (與 `infra/nas/docker-compose.yml` 一致)

---

## 1. NAS Docker 部署

```bash
# SSH 進入 NAS
ssh admin@nas-ip

# 建立資料目錄
mkdir -p /volume1/docker/chromadb/data

# 拉取 ChromaDB 映像
docker pull chromadb/chroma:latest

# 啟動 ChromaDB
docker run -d \
  --name chromadb \
  --restart unless-stopped \
  -p 8001:8000 \
  -v /volume1/docker/chromadb/data:/chroma/chroma \
  -e IS_PERSISTENT=TRUE \
  -e ANONYMIZED_TELEMETRY=FALSE \
  chromadb/chroma:latest

# 驗證 (注意: host port 是 8001)
curl http://localhost:8001/api/v2/heartbeat
# 預期: {"nanosecond heartbeat": 1234567890}
```

## 2. Collection 設計（Per-Agent Namespace）

```python
# 每個 Agent 擁有獨立 collection
collections = {
    "butler_memory":     "貼身管家對話記憶",
    "titan_projects":    "BIM 專案知識庫",
    "lumi_designs":      "室內設計案例庫",
    "rusty_estimates":   "估算歷史記錄",
    "guardian_policies":  "保險保單知識庫",
    "lex_contracts":     "法務合約知識庫",
    "sage_analytics":    "數據分析歷史",
    "nova_admin":        "行政事務記錄",
    "global_context":    "跨 Agent 共享知識",
}
```

## 3. memory-store.service.ts 介面規格

```typescript
interface MemoryStore {
  // 短期記憶（Redis, TTL 24h）
  getRecentContext(agentId: string, chatId: string, limit?: number): Promise<Message[]>;
  addMessage(agentId: string, chatId: string, message: Message): Promise<void>;

  // 長期記憶（ChromaDB, 永久）
  searchLongTerm(agentId: string, query: string, topK?: number): Promise<Memory[]>;
  saveLongTerm(agentId: string, content: string, metadata: MemoryMeta): Promise<string>;
  
  // 記憶遷移（短期 → 長期）
  promoteToLongTerm(agentId: string, chatId: string, threshold?: number): Promise<number>;
}

interface Memory {
  id: string;
  content: string;
  metadata: MemoryMeta;
  distance: number;  // 相似度距離
}

interface MemoryMeta {
  agent_id: string;
  chat_id: string;
  timestamp: string;
  importance: number;  // 0-1
  tags: string[];
}
```

## 4. 連線設定

### 方案 A: Tailscale (推薦)

```bash
# NAS 上安裝 Tailscale
# ChromaDB URL = http://100.x.x.x:8000

# GCP Secret Manager
gcloud secrets create CHROMADB_URL \
  --replication-policy=automatic \
  --data-file=-
# 輸入: http://100.x.x.x:8000
```

### 方案 B: LAN (僅限本地開發)

```bash
# ChromaDB URL = http://192.168.x.x:8000
# 注意: Cloud Run 無法存取 LAN
```

## 5. 整合步驟

1. NAS 部署 ChromaDB Docker
2. 設定 Tailscale 或 Cloudflare Tunnel
3. GCP Secret Manager 新增 `CHROMADB_URL`
4. `index.ts` 新增 Secret 定義
5. `butler-ai.service.ts` 注入記憶檢索邏輯
6. 測試 `/butler` 指令是否能回憶之前對話
