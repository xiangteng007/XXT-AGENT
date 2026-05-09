# OLLAMA_BASE_URL 設定 SOP

> **狀態**: ⚠️ 未設定 — 本地推理完全失效  
> **影響服務**: Firebase Functions (telegramWebhook, memoryOrganizer), Telegram Command Bot, Regulation RAG

---

## 問題

代碼已完整實作本地推理（`local-inference.service.ts`），但 `OLLAMA_BASE_URL` 從未在 Firebase Secret Manager 中建立。
所有推理請求都會 fallback 到 `http://localhost:11434`（在 Cloud Run 環境中不存在），導致健康檢查永遠失敗，
InferenceRouter 始終走雲端路線。

## 先決條件

1. RTX 4080 SUPER 工作站必須運行 Ollama（port 11434）
2. 需要一個穩定的方式讓 Cloud Run / Firebase Functions 連到本地工作站

## 方案 A: Tailscale Funnel（推薦）

```powershell
# 1. 確認 Tailscale 已安裝並登入
tailscale status

# 2. 啟用 Funnel（公開暴露 Ollama）
tailscale funnel 11434

# 3. 取得 Funnel URL（格式如下）
# https://your-machine.tailnet-xxxxx.ts.net
```

然後在 GCP Secret Manager 建立 Secret：

```bash
# 使用 gcloud CLI
echo -n "https://your-machine.tailnet-xxxxx.ts.net" | \
  gcloud secrets create OLLAMA_BASE_URL \
    --project=xxt-agent \
    --replication-policy="automatic" \
    --data-file=-
```

## 方案 B: Cloudflare Tunnel（備選）

```bash
# 安裝 cloudflared
cloudflared tunnel login
cloudflared tunnel create ollama-tunnel
cloudflared tunnel route dns ollama-tunnel ollama.yourdomain.com
cloudflared tunnel run --url http://localhost:11434 ollama-tunnel
```

## 方案 C: 固定公網 IP（不推薦）

直接使用路由器 port forwarding 暴露 11434，安全風險高。

## 驗證

```bash
# 確認 Secret 已建立
gcloud secrets versions access latest --secret=OLLAMA_BASE_URL --project=xxt-agent

# 重新部署 Firebase Functions（讓 Secret 生效）
cd apps/functions
firebase deploy --only functions:telegramWebhook,functions:memoryOrganizerDaily,functions:memoryOrganizerWeekly

# 驗證 Ollama 連線
curl $(gcloud secrets versions access latest --secret=OLLAMA_BASE_URL --project=xxt-agent)/api/tags
```

## 涉及程式碼

| 檔案 | 用途 |
|:---|:---|
| `apps/functions/src/index.ts:43` | `defineSecret('OLLAMA_BASE_URL')` |
| `apps/functions/src/services/local-inference.service.ts:85-90` | `getOllamaBaseUrl()` |
| `services/telegram-command-bot/src/config.py:24` | Pydantic Settings 讀取 |
| `services/regulation-rag/main.py:40` | 直接 `os.getenv` 讀取 |

## Cloud Run 服務也需要

Telegram Command Bot 和 Regulation RAG 是獨立 Cloud Run 服務，需要在 Terraform 或 `gcloud run deploy` 時注入：

```bash
gcloud run services update telegram-command-bot \
  --region=asia-east1 \
  --set-secrets=OLLAMA_BASE_URL=OLLAMA_BASE_URL:latest

gcloud run services update regulation-rag \
  --region=asia-east1 \
  --set-secrets=OLLAMA_BASE_URL=OLLAMA_BASE_URL:latest
```
