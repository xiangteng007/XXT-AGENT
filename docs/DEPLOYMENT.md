# XXT-AGENT 部署指南

> **版本**: 1.0  
> **最後更新**: 2026-02-04

---

## 1. 部署概覽

| 組件 | 平台 | 部署方式 |
|------|------|----------|
| **Frontend** | Vercel | Git Push (自動) |
| **Functions** | Firebase | `firebase deploy` |
| **Microservices** | Cloud Run | `gcloud run deploy` |

---

## 2. 前端部署 (Vercel)

### 2.1 專案設定

| 設定 | 值 |
|------|-----|
| **專案名稱** | xxt-frontend |
| **GitHub Repo** | xiangteng007/XXT-frontend |
| **Framework** | Next.js |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |

### 2.2 自動部署

```bash
# 推送到 main 分支自動觸發部署
git push origin main
```

### 2.3 手動部署

```bash
cd dashboard
npm install
npm run build
npx vercel --prod
```

### 2.4 環境變數

在 Vercel Dashboard 設定：

| 變數名稱 | 描述 |
|----------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API Key |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 專案 ID |
| `SENTRY_DSN` | Sentry DSN |

---

## 3. Firebase Functions 部署

### 3.1 前置作業

```bash
# 安裝 Firebase CLI
npm install -g firebase-tools

# 登入
firebase login

# 選擇專案
firebase use xxt-agent
```

### 3.2 部署指令

```bash
cd functions

# 安裝依賴
npm install

# 編譯 TypeScript
npm run build

# 部署所有 Functions
firebase deploy --only functions

# 部署特定 Function
firebase deploy --only functions:lineWebhook
```

### 3.3 設定 Secrets

```bash
# 設定 LINE Channel Secret
firebase functions:secrets:set LINE_CHANNEL_SECRET

# 設定 Notion Token
firebase functions:secrets:set NOTION_TOKEN

# 設定 Gemini API Key
firebase functions:secrets:set GEMINI_API_KEY
```

---

## 4. 微服務部署 (Cloud Run)

### 4.1 通用部署流程

```bash
cd services/<service-name>

# 建置 Docker 映像
docker build -t gcr.io/xxt-agent/<service-name> .

# 推送到 Container Registry
docker push gcr.io/xxt-agent/<service-name>

# 部署到 Cloud Run
gcloud run deploy <service-name> \
  --image gcr.io/xxt-agent/<service-name> \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated
```

### 4.2 AI Gateway 部署

```bash
cd services/ai-gateway

gcloud run deploy ai-gateway \
  --source . \
  --region asia-east1 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --allow-unauthenticated
```

### 4.3 環境變數設定

```bash
gcloud run services update <service-name> \
  --set-env-vars "KEY1=value1,KEY2=value2" \
  --region asia-east1
```

---

## 5. GCP 專案設定

### 5.1 專案資訊

| 項目 | 值 |
|------|-----|
| **專案名稱** | XXT-AGENT |
| **專案 ID** | xxt-agent |
| **專案編號** | 257379536720 |
| **區域** | asia-east1 |

### 5.2 啟用必要 API

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  cloudbuild.googleapis.com
```

### 5.3 Secret Manager 設定

```bash
# 建立 Secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "your-api-key" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 授權 Cloud Run 存取
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:xxt-agent@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 6. CI/CD (GitHub Actions)

### 6.1 工作流程檔案

位置: `.github/workflows/`

### 6.2 所需 Secrets

在 GitHub Repo Settings > Secrets 設定：

| Secret | 描述 |
|--------|------|
| `GCP_SA_KEY` | GCP Service Account Key (JSON) |
| `FIREBASE_PROJECT_ID` | Firebase 專案 ID |
| `VERCEL_TOKEN` | Vercel 部署 Token |

### 6.3 自動觸發

- **main 分支推送**: 觸發生產環境部署
- **Pull Request**: 觸發預覽部署

---

## 7. 本地開發

### 7.1 環境設定

```bash
# 複製環境變數範本
cp .env.example .env.local

# 編輯環境變數
code .env.local
```

### 7.2 啟動前端

```bash
cd dashboard
npm install
npm run dev
# 訪問 http://localhost:3000
```

### 7.3 啟動 Functions Emulator

```bash
cd functions
npm install
npm run build
firebase emulators:start
```

### 7.4 啟動微服務

```bash
cd services
docker-compose -f docker-compose.dev.yml up
```

---

## 8. 監控與日誌

### 8.1 GCP Console 連結

| 資源 | URL |
|------|-----|
| **總覽** | https://console.cloud.google.com/welcome?project=xxt-agent |
| **Cloud Run** | https://console.cloud.google.com/run?project=xxt-agent |
| **Cloud Functions** | https://console.cloud.google.com/functions?project=xxt-agent |
| **Firestore** | https://console.firebase.google.com/project/xxt-agent/firestore |
| **Logs** | https://console.cloud.google.com/logs?project=xxt-agent |

### 8.2 Sentry (前端)

- Dashboard: https://sentry.io
- 專案: xxt-frontend

---

## 9. 故障排除

### 9.1 常見問題

| 問題 | 解決方案 |
|------|----------|
| Functions 部署失敗 | 檢查 `npm run build` 是否成功 |
| Secret 存取被拒 | 確認 IAM 權限設定 |
| Cloud Run 503 | 檢查容器啟動日誌 |
| Vercel 建置失敗 | 檢查 Next.js 編譯錯誤 |

### 9.2 日誌查看

```bash
# Firebase Functions 日誌
firebase functions:log

# Cloud Run 日誌
gcloud run services logs read <service-name> --region asia-east1
```
