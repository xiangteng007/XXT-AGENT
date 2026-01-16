# OPS Runbook — LINE-Notion Platform

運維手冊：常見操作與故障排除

---

## 1. 新增租戶

### Dashboard UI

1. 登入 Dashboard → 租戶管理
2. 點擊「新增租戶」
3. 填寫：
   - **ID**: 唯一識別碼（建議用英數）
   - **Destination**: LINE Channel ID
   - **Default Database ID**: Notion Database ID

### CLI / Firestore Console

```js
// Collection: tenants
{
  id: "my-tenant",
  destination: "U1234567890abc",
  channelId: "U1234567890abc",
  defaultDatabaseId: "abc123...",
  settings: {
    timezone: "Asia/Taipei",
    enabled: true,
    retentionDays: 30
  }
}
```

---

## 2. 新增規則

### Dashboard UI

1. 租戶管理 → 規則管理
2. 選擇租戶
3. 新增規則，設定：
   - **名稱**: 例如「Todo 任務」
   - **匹配類型**: prefix / keyword / contains / regex
   - **匹配值**: 例如 `#todo`
   - **Database ID**: 目標 Notion 資料庫

### 規則測試

輸入測試文字，確認匹配結果正確再啟用。

---

## 3. 處理 DLQ 任務

### 查看失敗任務

1. Dashboard → 任務佇列
2. 篩選狀態：`failed` 或 `dead`

### 重送任務

1. 找到失敗任務
2. 點擊「🔄 重送」
3. 任務狀態變為 `queued`，Worker 會重新處理

### 忽略任務

若任務確認無需處理：

1. 點擊「忽略」
2. 狀態變為 `ignored`

---

## 4. 常見故障排除

### 問題：Notion 429 Too Many Requests

**原因**: Notion API 有每秒 3 次請求限制

**解決**:

1. 檢查 metrics → notion_429 計數
2. 等待 rate limit 重置（約 1 秒）
3. 若持續，降低 tenant 的訊息量
4. Worker 已內建 exponential backoff，通常會自動恢復

---

### 問題：LINE 重複發送 Webhook

**原因**: Webhook handler 回應太慢（>10s），LINE 會重試

**解決**:

1. 確保快速 ACK（不在 webhook 等 Notion 寫入）
2. 檢查 `processedEvents` 去重是否生效
3. 檢查 logs 是否有重複 eventId

---

### 問題：Webhook Signature Verification Failed

**原因**: rawBody 與 X-Line-Signature 不符

**排查**:

1. 確認使用實際 rawBody（非 JSON.stringify 後的）
2. 確認 Channel Secret 正確
3. 檢查是否有中間件修改了 request body

**修復**: 確保 webhook handler 使用 `req.rawBody`

---

### 問題：Dashboard 登入後顯示「拒絕存取」

**原因**: Firebase UID 不在 admins 集合

**解決**:

1. 在 Firestore Console 新增 admins 文件
2. Document ID = 該用戶的 Firebase UID
3. 設定：

```json
{
  "enabled": true,
  "role": "admin",
  "allowTenants": []
}
```

---

## 5. 監控指標

### 關鍵指標

| 指標 | 正常範圍 | 警告條件 |
|------|---------|---------|
| 成功率 | >95% | <90% |
| Notion 429 | <10/日 | >50/日 |
| DLQ 數量 | 0 | >5 |
| 平均延遲 | <2000ms | >5000ms |

### 日誌查詢

- 按 jobId 追溯：`/logs?jobId=xxx`
- 按類型查詢：`/logs?type=error`

---

## 6. 備份與清理

### 日誌保留

- 預設保留 30 天
- 可在 tenant settings.retentionDays 調整
- 清理 job: Cloud Function 定期執行

### Firestore 備份

```bash
gcloud firestore export gs://your-bucket/backup/$(date +%Y%m%d)
```

---

## 7. 部署檢查清單

- [ ] Functions 部署成功
- [ ] Firestore rules 已更新
- [ ] Dashboard 可登入
- [ ] Webhook 可接收 LINE 訊息
- [ ] Worker 可寫入 Notion
- [ ] Logs 正常記錄
- [ ] Metrics 正常累計
