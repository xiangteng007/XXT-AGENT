# XXT-AGENT API 文件

> **版本**: 1.0  
> **最後更新**: 2026-02-04

---

## 1. API 概覽

### 1.1 基礎資訊

| 項目 | 值 |
|------|-----|
| **後端 URL** | Firebase Functions (asia-east1) |
| **認證方式** | Firebase Authentication |
| **回應格式** | JSON |

---

## 2. Firebase Functions Endpoints

### 2.1 LINE Webhook

```http
POST /lineWebhook
```

**描述**: 接收 LINE 平台 Webhook 事件

**Headers**:
| Header | 必要 | 描述 |
|--------|------|------|
| `X-Line-Signature` | 是 | LINE 簽章驗證 |
| `Content-Type` | 是 | application/json |

**Request Body**:
```json
{
  "destination": "channel_id",
  "events": [
    {
      "type": "message",
      "message": {
        "type": "text",
        "text": "#todo 買菜"
      },
      "replyToken": "...",
      "source": {
        "type": "user",
        "userId": "..."
      }
    }
  ]
}
```

**Response**: `200 OK`
```json
{ "status": "accepted", "jobIds": ["job_123"] }
```

---

### 2.2 LINE Worker

```http
POST /lineWorker
```

**描述**: 手動觸發任務處理（用於測試）

**Response**: `200 OK`
```json
{
  "status": "completed",
  "processed": 5,
  "failed": 0
}
```

---

### 2.3 LINE Cleanup

```http
POST /lineCleanup
```

**描述**: 手動觸發資料清理

**Response**: `200 OK`
```json
{
  "status": "completed",
  "cleaned": {
    "jobs": 10,
    "logs": 50,
    "images": 5
  }
}
```

---

## 3. 前端 API Routes

所有 API 位於 `/api/admin/` 路徑下。

### 3.1 Events API

```http
GET /api/admin/events
```

**描述**: 獲取系統事件列表

**Query Parameters**:
| 參數 | 類型 | 描述 |
|------|------|------|
| `limit` | number | 限制筆數 (預設 50) |
| `domain` | string | 過濾域 (market/news/social) |

---

### 3.2 Jobs API

```http
GET /api/admin/jobs
```

**描述**: 獲取任務佇列

```http
POST /api/admin/jobs/retry
```

**描述**: 重試失敗任務

---

### 3.3 Logs API

```http
GET /api/admin/logs
```

**描述**: 獲取系統日誌

---

### 3.4 Tenants API

```http
GET /api/admin/tenants
POST /api/admin/tenants
PUT /api/admin/tenants/:id
DELETE /api/admin/tenants/:id
```

**描述**: 租戶 CRUD 操作

---

### 3.5 Rules API

```http
GET /api/admin/rules
POST /api/admin/rules
PUT /api/admin/rules/:id
DELETE /api/admin/rules/:id
```

**描述**: 規則 CRUD 操作

---

### 3.6 Metrics API

```http
GET /api/admin/metrics
```

**描述**: 獲取系統指標

---

## 4. AI Gateway API

### 4.1 Enrich Content

```http
POST /api/enrich
```

**Host**: `ai-gateway-*.run.app`

**Request Body**:
```json
{
  "type": "social",
  "content": "市場大跌，恐慌情緒蔓延",
  "context": {
    "platform": "twitter",
    "location": "tw"
  }
}
```

**Response**:
```json
{
  "severity": 75,
  "sentiment": "negative",
  "keywords": ["市場", "大跌", "恐慌"],
  "entities": [
    { "type": "topic", "value": "市場恐慌" }
  ],
  "impactHint": "可能引發進一步拋售",
  "rationale": "負面情緒詞彙密集，嚴重度評估為高"
}
```

---

## 5. 資料模型

### 5.1 Job (任務)

```typescript
interface Job {
  id: string;
  tenantId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: {
    eventType: string;
    messageId: string;
    content: string;
  };
  retryCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 5.2 Event (事件)

```typescript
interface Event {
  id: string;
  domain: 'market' | 'news' | 'social' | 'fused';
  severity: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  content: string;
  entities: Entity[];
  createdAt: Timestamp;
}
```

### 5.3 Entity (實體)

```typescript
interface Entity {
  type: 'ticker' | 'fund' | 'future' | 'topic' | 'location' | 'person' | 'org';
  value: string;
  confidence?: number;
}
```

### 5.4 Tenant (租戶)

```typescript
interface Tenant {
  id: string;
  name: string;
  lineChannelId: string;
  notionDatabaseId: string;
  active: boolean;
  createdAt: Timestamp;
}
```

### 5.5 Rule (規則)

```typescript
interface Rule {
  id: string;
  tenantId: string;
  name: string;
  type: 'keyword' | 'regex';
  pattern: string;
  targetDatabase: string;
  fieldMappings: Record<string, string>;
  active: boolean;
}
```

---

## 6. 錯誤處理

### 6.1 錯誤回應格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "content",
      "reason": "required"
    }
  }
}
```

### 6.2 錯誤代碼

| Code | HTTP Status | 描述 |
|------|-------------|------|
| `VALIDATION_ERROR` | 400 | 請求驗證失敗 |
| `UNAUTHORIZED` | 401 | 未授權 |
| `FORBIDDEN` | 403 | 權限不足 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `RATE_LIMITED` | 429 | 請求過於頻繁 |
| `INTERNAL_ERROR` | 500 | 伺服器錯誤 |
