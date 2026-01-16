# LINE to Notion Multi-Tenant Platform

將 LINE 訊息自動寫入 Notion Database 的 Serverless 平台。

## 功能特色

- 🚀 **Serverless 架構**：基於 Firebase Cloud Functions，無需管理伺服器
- 👥 **多租戶支援**：支援多團隊、多專案獨立設定
- 🔧 **規則引擎**：靈活的關鍵字/正則匹配規則
- 🔒 **安全設計**：Secret Manager 管理金鑰、LINE 簽章驗證
- 📊 **完整日誌**：Cloud Logging 結構化日誌 + Firestore 操作紀錄
- 🔄 **自動重試**：內建 Rate Limit 處理與指數退避重試

## 技術架構

```
LINE User → LINE Platform → Cloud Functions → Firestore (Config)
                                     ↓
                              Notion API → Notion Database
```

## 快速開始

### 前置需求

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud 專案（已啟用 Firestore、Cloud Functions、Secret Manager）
- LINE Official Account（Messaging API）
- Notion Integration

### 安裝步驟

```powershell
# 1. Clone 專案
cd C:\Users\xiang\SENTENG-LINEBOT-NOTION

# 2. 安裝相依套件
cd functions
npm install

# 3. 設定 Firebase 專案
# 編輯 .firebaserc 填入你的專案 ID
firebase use --add

# 4. 設定 Secret Manager
# 參考下方「Secret 設定」章節

# 5. 部署
npm run build
firebase deploy
```

### Secret 設定

```powershell
# 啟用 Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 建立 LINE secrets
gcloud secrets create line-channel-secret-default --replication-policy="automatic"
echo -n "YOUR_LINE_CHANNEL_SECRET" | gcloud secrets versions add line-channel-secret-default --data-file=-

gcloud secrets create line-access-token-default --replication-policy="automatic"
echo -n "YOUR_LINE_ACCESS_TOKEN" | gcloud secrets versions add line-access-token-default --data-file=-

# 建立 Notion secret
gcloud secrets create notion-token-default --replication-policy="automatic"
echo -n "YOUR_NOTION_TOKEN" | gcloud secrets versions add notion-token-default --data-file=-

# 授權 Cloud Functions 存取
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 專案結構

```
.
├── .github/workflows/deploy.yml    # CI/CD 設定
├── functions/
│   ├── src/
│   │   ├── index.ts               # Functions 入口
│   │   ├── config/                # Firebase 設定
│   │   ├── handlers/              # Webhook 處理
│   │   ├── services/              # 業務邏輯
│   │   ├── models/                # 資料模型
│   │   ├── types/                 # TypeScript 定義
│   │   └── utils/                 # 工具函式
│   ├── package.json
│   └── tsconfig.json
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

## 使用範例

設定規則後，傳送訊息給 LINE Bot：

```
#todo 買菜
#idea 新產品構想
#urgent 今日必做
```

系統會依據規則將訊息寫入對應的 Notion Database。

## 本地開發

```powershell
# 啟動 Firebase Emulators
cd functions
npm run serve

# 測試 Webhook (另開終端)
curl -X POST http://127.0.0.1:5001/PROJECT_ID/asia-east1/lineWebhook \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: test" \
  -d '{"destination":"CHANNEL_ID","events":[{"type":"message","message":{"type":"text","text":"#todo 測試"}}]}'
```

## GitHub Actions Secrets

部署需設定以下 GitHub Secrets：

| Secret | 說明 |
|--------|------|
| `FIREBASE_PROJECT_ID` | Firebase 專案 ID |
| `GCP_SA_KEY` | GCP Service Account Key (JSON) |

## License

MIT
