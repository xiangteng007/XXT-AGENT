# Regulation RAG Service

**NemoClaw Layer 4 — 台灣建築/消防/稅務/勞工法規本地語義搜尋**

> 📍 Port: `8092` | 模型: `nomic-embed-text` (Ollama) | 向量搜尋: 純 Python numpy

---

## 功能特點

| 功能 | 說明 |
|------|------|
| **語義搜尋** | 不需精確詞彙，用語意找到最相關法條 |
| **分類過濾** | building / fire / tax / cns / labor |
| **嵌入快取** | LRU Cache 256 entries + 1h TTL，重複查詢 0ms |
| **RAG+LLM** | 透過 Gateway `/regulation/ask` 取得 AI 整合回答 |
| **完全本地** | 資料不出境，RTX 4080 SUPER CUDA 推理 |

## 快速啟動

```bash
cd services/regulation-rag

# 1. 安裝依賴
python -m pip install -r requirements.txt

# 2. 生成種子法規資料
python seed_data.py

# 3. 建立向量索引（需 Ollama + nomic-embed-text）
python ingest.py

# 4. 啟動 FastAPI 服務
python start.py
```

## API 端點

### `POST /query` — 語義搜尋

```json
{
  "query": "住宅建蔽率限制",
  "category": "building",
  "top_k": 5
}
```

**回應：**
```json
{
  "query": "住宅建蔽率限制",
  "results": [
    {
      "content": "第四十三條（建築物高度）...",
      "source": "建築技術規則 第四十三條",
      "category": "building",
      "score": 0.82,
      "knowledge_date": "2024-07-01"
    }
  ],
  "total_chunks_searched": 14,
  "latency_ms": 45.2,
  "embed_model": "nomic-embed-text"
}
```

### `GET /health` — 健康狀態

```json
{
  "status": "ok",
  "chunks": 34,
  "ollama": true,
  "embed_model": "nomic-embed-text",
  "cache": {"hits": 42, "misses": 8, "hit_rate": 84.0}
}
```

### `GET /categories` — 分類列表

```json
{"categories": ["building", "cns", "fire", "labor", "tax"]}
```

### `GET /sources?category=building` — 法規來源

### `GET /cache/stats` — 快取統計

### `POST /cache/clear` — 清除快取（重新 ingest 後執行）

## 法規分類

| category | 涵蓋法規 |
|----------|---------|
| `building` | 建築技術規則、建築法 |
| `fire` | 消防法、各類場所消防安全設備設置標準 |
| `tax` | 統一發票使用辦法、所得稅法、營業稅法 |
| `cns` | CNS 鋼材/水泥/鋼筋相關國家標準 |
| `labor` | 勞動基準法核心條文 |

## 新增法規文件

```bash
# 將 PDF/TXT/HTML 法規文件放到對應目錄
services/regulation-rag/data/
├── building/         # 建築法規
├── fire-safety/      # 消防法規
├── tax/              # 稅務法規
├── cns-standards/    # CNS 標準
└── labor/            # 勞工法規

# 重新索引（只會更新新文件）
python ingest.py

# 清除舊快取
curl -X POST http://localhost:8092/cache/clear
```

## 透過 OpenClaw Gateway 使用

所有外部請求建議走 Gateway（需 Firebase JWT）：

```bash
# 語義搜尋
POST http://localhost:3100/regulation/query
Authorization: Bearer <Firebase JWT>

# RAG + LLM 完整問答
POST http://localhost:3100/regulation/ask
{"question": "住宅建蔽率最高是多少？"}

# 健康檢查（公開）
GET http://localhost:3100/system/health
```

## Telegram Bot 指令

```
/reg 住宅建蔽率限制          → 全分類搜尋
/reg building 建蔽率          → 只搜尋建築法規
/reg fire 滅火器設置           → 只搜尋消防法規
/reg tax 統一發票申報          → 只搜尋稅務法規
/reg labor 特休天數            → 只搜尋勞工法規
```

## 架構關係

```
Telegram Bot (/reg) ──→ Regulation RAG :8092
SENTENG ERP       ──→ OpenClaw Gateway :3100 → /regulation/query → RAG
Office Dashboard  ──→ OpenClaw Gateway :3100 → /regulation/ask  → RAG + qwen3:14b
```

## 效能基準（RTX 4080 SUPER, 34 chunks）

| 操作 | 首次（冷啟動） | 後續（快取命中） |
|------|--------------|----------------|
| 語義搜尋 | ~1400ms | ~5ms |
| RAG+LLM 問答 | ~8000ms | ~6000ms (embed cached) |
| Embed 延遲 | ~1300ms | 0ms (cached) |

---

*NemoClaw Layer 4 | XXT-AGENT Project | RTX 4080 SUPER 16GB VRAM*
