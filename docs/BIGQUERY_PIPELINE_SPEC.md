# BigQuery 分析管線規格

> **目標**: 將 Pub/Sub `audit.log` 事件串流寫入 BigQuery 進行分析  
> **架構**: Pub/Sub → BigQuery Subscription (直接寫入)  
> **實作狀態**: ✅ 設定腳本就緒 — `infra/scripts/setup_bigquery_pipeline.sh`

---

## 1. 架構

```
Telegram Bot / News Collector / OpenClaw Gateway
        │ publish audit events
        ↓
   ┌──────────────────┐
   │  Pub/Sub Topic    │
   │  audit.log        │
   └──────────────────┘
        │ BigQuery Subscription
        ↓
   ┌──────────────────┐
   │  BigQuery Table    │
   │  xxt_agent.audit  │
   └──────────────────┘
        │
        ↓
   ┌──────────────────┐
   │  Looker Studio     │
   │  Dashboard         │
   └──────────────────┘
```

## 2. BigQuery 表結構

```sql
CREATE TABLE IF NOT EXISTS `xxt-agent.analytics.audit_events` (
  audit_id STRING NOT NULL,
  schema_version STRING,
  event_type STRING NOT NULL,
  action STRING NOT NULL,
  resource STRING NOT NULL,
  actor STRING NOT NULL,
  trace_id STRING,
  timestamp TIMESTAMP NOT NULL,
  metadata JSON,
  
  -- 分區與叢集
) PARTITION BY DATE(timestamp)
  CLUSTER BY actor, action
  OPTIONS(
    description = 'XXT-AGENT 稽核事件',
    labels = [("env", "production")]
  );
```

## 3. Pub/Sub → BigQuery 直接寫入

```bash
# 建立 BigQuery Subscription（無需額外 Cloud Function）
gcloud pubsub subscriptions create audit-to-bigquery \
  --topic=audit.log \
  --bigquery-table=xxt-agent:analytics.audit_events \
  --use-topic-schema \
  --write-metadata
```

> **注意**: 需先在 Pub/Sub topic 設定 schema，或使用 `--drop-unknown-fields`

## 4. 替代方案：Dataflow 管線

若需轉換邏輯（例如 JSON flatten、欄位映射）：

```bash
gcloud dataflow flex-template run audit-pipeline \
  --template-file-gcs-location=gs://dataflow-templates/latest/PubSub_to_BigQuery \
  --parameters \
    inputTopic=projects/xxt-agent/topics/audit.log,\
    outputTableSpec=xxt-agent:analytics.audit_events
```

## 5. Looker Studio Dashboard 建議

| 視覺化 | 資料源 | 說明 |
|:---|:---|:---|
| 時間序列圖 | `COUNT(*) GROUP BY DATE(timestamp)` | 每日事件量 |
| 圓餅圖 | `COUNT(*) GROUP BY actor` | 各服務事件分布 |
| 表格 | `WHERE action LIKE '%error%'` | 錯誤事件清單 |
| 計數卡片 | `COUNT(DISTINCT actor)` | 活躍服務數 |
| 熱力圖 | `COUNT(*) GROUP BY HOUR(timestamp), actor` | 服務活動時段 |

## 6. 現有 audit 事件來源

| 服務 | Topic | 事件類型 |
|:---|:---|:---|
| news-collector | `audit.log` | `news_collection_run` |
| telegram-command-bot | `audit.log` | `cmd_audit` (v9.1+) |
| openclaw-gateway | `audit.log` | agent routing events |

## 7. 成本估算

- BigQuery 儲存: 前 10GB 免費
- BigQuery 查詢: 前 1TB/月 免費
- Pub/Sub: 前 10GB/月 免費
- 預估月成本: **< $5 USD** (低流量)
