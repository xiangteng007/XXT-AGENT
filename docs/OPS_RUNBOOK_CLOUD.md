# Ops Runbook — XXT-AGENT Cloud Infrastructure

> **最後更新**: 2026-05-04  
> **GCP Project**: xxt-agent (257379536720)  
> **Region**: asia-east1 (Taiwan)

---

## 1. 服務拓撲

| 服務 | 類型 | Always-On | Source |
|:---|:---|:---:|:---|
| Firebase Functions | Cloud Functions v2 | — | `apps/functions` |
| OpenClaw Gateway v7.5 | Cloud Run | ❌ | `services/openclaw-gateway` |
| Telegram Command Bot | Cloud Run | ❌ | `services/telegram-command-bot` |
| Regulation RAG | Cloud Run (Internal) | ❌ | `services/regulation-rag` |
| Market Streamer | Cloud Run | ✅ | `services/market-streamer` |
| Event Fusion Engine | Cloud Run | ✅ | `services/event-fusion-engine` |
| News Collector | Cloud Functions | — | `apps/functions` |
| AI Gateway | Cloud Run | ❌ | `services/ai-gateway` |
| Quote Normalizer | Cloud Run | ❌ | `services/quote-normalizer` |
| Social Worker / Dispatcher | Cloud Run | ✅ | `services/social-*` |
| Alert Engine | Cloud Run | ❌ | `services/alert-engine` |

### Always-On 服務（必須設定 min_instances=1）

```hcl
# Terraform: cpu_idle = false, min_instance_count = 1
# 適用: market-streamer, event-fusion-engine, social-worker, social-dispatcher
```

---

## 2. 常見故障排除

### A) Pub/Sub Permission Denied

```bash
# 確認 runtime service account 權限
gcloud projects get-iam-policy xxt-agent \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/pubsub"

# 必要角色:
# roles/pubsub.publisher
# roles/pubsub.subscriber
# roles/secretmanager.secretAccessor
```

### B) Telegram Bot 無回應

```bash
# 1. 檢查 webhook 設定
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# 2. 檢查 Cloud Run 日誌
gcloud run services logs read telegram-command-bot \
  --region=asia-east1 --limit=50

# 3. 確認 Secret Manager secrets 存在
gcloud secrets list --project=xxt-agent --filter="name:TELEGRAM"
```

### C) Ollama 本地推理失敗

```bash
# 1. 確認 Ollama 運行
curl http://localhost:11434/api/tags

# 2. 確認 OLLAMA_BASE_URL 已設定
gcloud secrets versions access latest \
  --secret=OLLAMA_BASE_URL --project=xxt-agent

# 3. 驗證 Tailscale Funnel 狀態
tailscale funnel status

# 完整 SOP: docs/SOP_OLLAMA_BASE_URL.md
```

### D) Cloud Run Container 啟動失敗

```bash
# 檢查最近部署版本
gcloud run revisions list --service=<SERVICE> --region=asia-east1

# 查看失敗日誌
gcloud run services logs read <SERVICE> \
  --region=asia-east1 --limit=100

# 常見原因:
# - TypeORM metadata 缺失 → 確認 LegacyEntitiesModule 包含所有 entity
# - Secret 不存在 → gcloud secrets list
# - 記憶體不足 → 升級 memory limit
```

### E) Firebase Functions Cold Start 超時

```bash
# 查看 functions 日誌
firebase functions:log --only telegramWebhook

# 調整設定 (index.ts):
# timeoutSeconds: 90 (Telegram webhook)
# memory: '512MiB'
# secrets: [ollamaBaseUrl, chromadbUrl]
```

---

## 3. 告警設定建議

| 告警 | 條件 | 通知方式 |
|:---|:---|:---|
| DLQ 積累 | DLQ message count > 0 | Telegram 推送 |
| Rate Limit 觸發 | 429 responses > 10/min | Cloud Monitoring |
| 管線延遲 | Fusion event latency > 30s | Pub/Sub 監控 |
| 服務不健康 | Health check 連續失敗 3 次 | Uptime Check alert |
| Secret 即將過期 | Secret version < 30 days | Email |

```bash
# 建立 Uptime Check（範例）
gcloud monitoring uptime create \
  --display-name="OpenClaw Gateway Health" \
  --resource-type=cloud-run-revision \
  --monitored-resource="//run.googleapis.com/projects/xxt-agent/locations/asia-east1/services/openclaw-gateway" \
  --http-check-path="/healthz" \
  --period=300
```

---

## 4. 成本控制

| 策略 | 說明 |
|:---|:---|
| **Scheduler + Tasks** | Collector 類服務使用 Cloud Scheduler 觸發，不常駐 |
| **Always-On 最小化** | 僅 market-streamer、event-fusion、social-* 常駐 |
| **冷啟動優化** | Firebase Functions 使用 dynamic import (#17) |
| **交易時段限制** | Market Streamer 僅交易時段（9-14 TWD, 9:30-16 US）活動 |
| **記憶體分配** | 輕量 API: 256MiB, 重量 AI: 512MiB |

```bash
# 查看當月費用
gcloud billing accounts list
gcloud billing budgets list --billing-account=<ACCOUNT_ID>
```

---

## 5. 部署流程

### 標準部署（Cloud Run）

```bash
# 1. 建置 Docker image
docker build -t asia-east1-docker.pkg.dev/xxt-agent/cloud-run/<SERVICE> \
  -f services/<SERVICE>/Dockerfile services/<SERVICE>

# 2. 推送
docker push asia-east1-docker.pkg.dev/xxt-agent/cloud-run/<SERVICE>

# 3. 部署
gcloud run deploy <SERVICE> \
  --image=asia-east1-docker.pkg.dev/xxt-agent/cloud-run/<SERVICE> \
  --region=asia-east1 \
  --set-secrets=OLLAMA_BASE_URL=OLLAMA_BASE_URL:latest

# 4. 驗證
curl https://<SERVICE>-257379536720.asia-east1.run.app/healthz
```

### Firebase Functions 部署

```bash
cd apps/functions
firebase deploy --only functions
firebase functions:log  # 驗證
```

---

## 6. 事件回應 SOP

### Severity 定義

| Level | 定義 | 回應時間 |
|:---|:---|:---|
| **P0** | 全系統中斷（所有 bot 無回應） | 15 分鐘 |
| **P1** | 單一服務中斷（推理/推送失敗） | 1 小時 |
| **P2** | 效能退化（延遲 >5s） | 4 小時 |
| **P3** | 非緊急（資料延遲、UI 異常） | 24 小時 |

### 回應步驟

1. **確認影響範圍**: 使用 `/system` Telegram 指令或 Dashboard System Health 頁面
2. **查看日誌**: `gcloud run services logs read <SERVICE>`
3. **回滾**: `gcloud run services update-traffic <SERVICE> --to-revisions=<PREVIOUS>=100`
4. **通知**: 在 Telegram Admin 群組發布狀態更新
5. **事後分析**: 更新 `docs/postmortem/` 目錄
