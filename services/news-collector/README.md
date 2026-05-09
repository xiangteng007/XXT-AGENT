# News Collector v9.2

> 多來源新聞收集 Cloud Run 服務

## 架構

```
Cloud Scheduler (每分鐘)
    ↓ POST /run
┌────────────────────────────┐
│     news-collector v9.2    │
│                            │
│  ┌──────────────────────┐  │
│  │ 1. Finnhub API       │  │  → 市場新聞
│  │ 2. RSS Feeds         │  │  → 自訂 RSS 來源
│  │ 3. CoinGecko (v9.2)  │  │  → 加密貨幣趨勢
│  └──────────┬───────────┘  │
│             ↓              │
│  ┌──────────────────────┐  │
│  │ Redis 去重 (24h TTL) │  │
│  └──────────┬───────────┘  │
│             ↓              │
│  ┌──────────────────────┐  │
│  │ Pub/Sub news.raw     │  │  → 下游處理
│  │ Pub/Sub audit.log    │  │  → 稽核追蹤
│  │ Firestore market_news│  │  → Dashboard 顯示
│  │ Redis news cache     │  │  → Telegram /news
│  └──────────────────────┘  │
└────────────────────────────┘
```

## 環境變數

| 變數 | 必填 | 說明 | 預設 |
|:---|:---:|:---|:---|
| `GCP_PROJECT_ID` | ✅ | GCP 專案 ID | — |
| `FINNHUB_API_KEY` | ⚠️ | Finnhub API 金鑰 | — |
| `RSS_URLS` | — | 逗號分隔 RSS URLs | — |
| `COINGECKO_ENABLED` | — | 啟用 CoinGecko 來源 | `false` |
| `REDIS_HOST` | — | Redis 主機 | `127.0.0.1` |
| `REDIS_PORT` | — | Redis 埠 | `6379` |
| `TOPIC_NEWS_RAW` | — | 新聞 Pub/Sub topic | `news.raw` |
| `TOPIC_AUDIT_LOG` | — | 稽核 Pub/Sub topic | `audit.log` |
| `OTEL_ENABLED` | — | OpenTelemetry 追蹤 | `false` |

## 本地開發

```bash
cd services/news-collector

# 安裝依賴
pip install -r requirements.txt

# 設定環境變數
export FINNHUB_API_KEY=your_key
export COINGECKO_ENABLED=true
export REDIS_HOST=127.0.0.1

# 啟動
python -m aiohttp.web src.main:create_app --port 8080

# 測試收集
curl -X POST http://localhost:8080/run
curl http://localhost:8080/healthz
```

## 部署

```bash
gcloud run deploy news-collector \
  --source . \
  --region asia-east1 \
  --platform managed \
  --set-env-vars "GCP_PROJECT_ID=xxt-agent,COINGECKO_ENABLED=true"
```

## 版本歷史

| 版本 | 日期 | 變更 |
|:---|:---|:---|
| v9.0 | 2026-04 | 初始版本：Finnhub + RSS + Pub/Sub + Firestore |
| v9.1 | 2026-04 | Redis news cache for Telegram /news |
| v9.2 | 2026-05 | CoinGecko trending + market movers 整合 |
