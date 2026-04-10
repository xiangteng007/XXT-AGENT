# Query Verification Protocol (QVP) 技術白皮書

> 本文件為 XXT-AGENT v6.0 架構的一部分，旨在規範 Agent-to-Agent (A2A) 通訊與資料寫入驗證標準。

## 1. 協議概述

隨著系統擴充為 7 實體與 20 位 Agent，防止不同職能之 AI 產生數據衝突（如：Scout 紀錄的維修費，並未正確存入 Accountant 帳本）是首要任務。

**QVP (Query Verification Protocol)** 即「質詢驗證協議」，它要求任何「具備財務、合約、法務效力」的狀態變更，必須經過對應「主權 Agent (Sovereign Agent)」的驗證與接收，才能持久化寫入資料庫 (Firestore)。

## 2. Write-Request 推送機制

當下游 Agent（如 `Scout`）需要向上游 Agent（如 `Accountant`）發起資料寫入時，請遵循以下標準：

### 2.1 Payload 結構

寫入請求必須透過內網 Gateway (`http://localhost:3000/v1/agent/...`) 以 POST 發送。

```json
{
  "source_agent": "scout",
  "target_agent": "accountant",
  "entity_type": "company",
  "intent": "EXPENSE_RECORD",
  "idempotency_key": "evt_20260405_drone1_repair",
  "payload": {
    "amount": 15000,
    "currency": "TWD",
    "description": "DJI Matrice 300 螺旋槳維修",
    "date": "2026-04-05"
  }
}
```

### 2.2 Idempotency Key (冪等性金鑰) 防呆機制

所有 write-request 必須攜帶全域唯一的 `idempotency_key`。
- 上游 Agent 接收到請求後，應優先透過 Redis / Firestore 查驗該 Key 是否已存在。
- 若存在，直接回傳 `200 OK`，無需重複計算與寫入，防止網路重試造成帳本重複入帳。

## 3. 錯誤處理與 Fallback (降級策略)

由於內網 HTTP 請求可能遭遇壅塞或目標 Agent (上游) 掛掉的情況，必須實作以下防護策略：

1. **Timeout 規範**：所有 QVP 請求 Timeout 強制設定為 **5000ms** (`AbortSignal`)。
2. **自動重試 (Retry)**：Timeout 後，應利用 `WriteRequestQueue` 排入最多三次的指數退避重試（Exponential Backoff）。
3. **Dead-Letter 通知**：若三次重試皆失敗，該請求寫入 Firestore 的 `dead_letters` 集合，並觸發 Alert Engine，向 USER (@SENTENGMAIN_BOT) 推播：
   > ⚠️ [系統警報] Scout 發送至 Accountant 的維修帳目(15,000元)寫入逾時，已轉入隔離區待手動人工確認。

## 4. 驗證合規性掃描

QVP 嚴格對接系統憲法的 CAVP 條款，未來開發新 Agent 時：
1. 任何跨域請求都必須實作 QVP payload。
2. 缺乏 QVP 邏輯的 `.ts` 或 python node 將無法通過 CI 審查。
