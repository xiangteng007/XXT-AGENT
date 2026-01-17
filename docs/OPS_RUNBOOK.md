# XXT-AGENT Operations Runbook v2.0

> 運維手冊：XXT-AGENT 生產級監控系統
> GCP Project: `investment-manager-1007`

---

## 1. 服務清單

| 服務 | 類型 | URL | Region |
|------|------|-----|--------|
| ai-gateway | Cloud Run | <https://ai-gateway-400584093075.asia-east1.run.app> | asia-east1 |
| xxt-frontend | Vercel | <https://xxt-frontend.vercel.app> | - |

---

## 2. 健康檢查

### AI Gateway

```bash
curl https://ai-gateway-400584093075.asia-east1.run.app/health
```

**預期回應:**

```json
{"status":"healthy","service":"ai-gateway","geminiReady":true}
```

### 關鍵狀態

- `geminiReady: true` → Gemini API 正常
- `geminiReady: false` → 檢查 Secret Manager

---

## 3. Secret Manager

| Secret | 用途 |
|--------|------|
| `gemini-api-key` | Gemini AI API Key |
| `telegram-bot-token` | Telegram Bot Token |
| `telegram-chat-id` | Telegram Chat ID |

### 查看 Secrets

```bash
gcloud secrets list --project investment-manager-1007
```

### 更新 Secret

```bash
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=- --project investment-manager-1007
```

---

## 4. 常見故障排除

### 問題：geminiReady: false

**解法:**

```bash
# 1. 檢查 secret 是否存在
gcloud secrets versions list gemini-api-key --project investment-manager-1007

# 2. 檢查 Cloud Run 綁定
gcloud run services describe ai-gateway --region asia-east1 --project investment-manager-1007

# 3. 重新綁定
gcloud run services update ai-gateway --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" --region asia-east1 --project investment-manager-1007
```

### 問題：Dashboard AI 功能錯誤

**檢查:**

1. Vercel 環境變數 `NEXT_PUBLIC_AI_GATEWAY_URL` 是否正確
2. AI Gateway 服務是否運行中
3. 瀏覽器 Console 錯誤訊息

### 問題：Cloud Run 冷啟動延遲

**解法:** 設定最小實例數

```bash
gcloud run services update ai-gateway --min-instances=1 --region asia-east1 --project investment-manager-1007
```

---

## 5. 部署指令

### ai-gateway 部署

```bash
cd services/ai-gateway
gcloud run deploy ai-gateway --source . --region asia-east1 --project investment-manager-1007
```

### Dashboard 重新部署

Vercel Dashboard → Deployments → 選擇版本 → Redeploy

---

## 6. 日誌查看

### Cloud Run Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ai-gateway" --project investment-manager-1007 --limit=50
```

### GCP Console
<https://console.cloud.google.com/run/detail/asia-east1/ai-gateway/logs?project=investment-manager-1007>

---

## 7. 監控指標

| 指標 | 正常範圍 | 警告條件 |
|------|---------|---------|
| 成功率 | >95% | <90% |
| 延遲 P99 | <5s | >10s |
| 錯誤率 | <5% | >10% |

---

## 8. 緊急聯絡

| 角色 | 聯絡方式 |
|------|----------|
| 維運 | (待填寫) |
| 開發 | (待填寫) |
