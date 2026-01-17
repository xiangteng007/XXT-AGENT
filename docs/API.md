# XXT-AGENT API Documentation

> Version 2.0.0 | Last Updated: 2026-01-17

## Overview

XXT-AGENT provides RESTful APIs for real-time market monitoring, news aggregation, and social media analysis.

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.xxt-agent.com` |
| AI Gateway | `https://ai-gateway-400584093075.asia-east1.run.app` |
| Dashboard | `https://xxt-frontend.vercel.app` |

> **GCP Project**: `investment-manager-1007`

---

## Authentication

All API requests require a Firebase ID token in the Authorization header:

```http
Authorization: Bearer <firebase-id-token>
```

---

## AI Gateway Endpoints

> Base: `/ai`

### POST /ai/summarize

Generate text summary.

**Request:**

```json
{
  "text": "要摘要的文字內容...",
  "maxLength": 200,
  "language": "zh-TW"
}
```

**Response:**

```json
{
  "summary": "摘要結果..."
}
```

---

### POST /ai/sentiment

Analyze text sentiment.

**Request:**

```json
{
  "text": "要分析的文字...",
  "context": "可選的背景資訊"
}
```

**Response:**

```json
{
  "label": "positive",
  "score": 0.85,
  "confidence": 0.92,
  "emotions": {
    "joy": 0.7,
    "anger": 0.05,
    "fear": 0.02,
    "sadness": 0.03,
    "surprise": 0.2
  },
  "keywords": ["關鍵詞1", "關鍵詞2"]
}
```

---

### POST /ai/impact

Assess market impact of news/event.

**Request:**

```json
{
  "title": "新聞標題",
  "content": "新聞內容（可選）",
  "symbols": ["AAPL", "TSLA"],
  "newsType": "earnings"
}
```

**Response:**

```json
{
  "severity": 75,
  "confidence": 0.88,
  "direction": "bearish",
  "timeframe": "short_term",
  "affectedSectors": ["科技", "電動車"],
  "affectedSymbols": ["AAPL", "TSLA"],
  "explanation": "影響說明...",
  "scores": {
    "market": 80,
    "news": 70,
    "social": 65
  }
}
```

---

### POST /ai/chat

General AI chat/Q&A.

**Request:**

```json
{
  "message": "使用者問題",
  "context": "背景資訊（可選）",
  "systemPrompt": "系統提示（可選）"
}
```

**Response:**

```json
{
  "reply": "AI 回覆..."
}
```

---

### POST /ai/batch-sentiment

Batch sentiment analysis.

**Request:**

```json
{
  "items": [
    { "id": "1", "content": "文字內容1" },
    { "id": "2", "content": "文字內容2" }
  ]
}
```

**Response:**

```json
{
  "results": [
    { "id": "1", "label": "positive", "score": 0.8, "confidence": 0.9 },
    { "id": "2", "label": "negative", "score": -0.5, "confidence": 0.85 }
  ]
}
```

---

## Admin Endpoints

> Base: `/api/admin`

### GET /api/admin/me

Get current admin user info.

**Response:**

```json
{
  "uid": "user-id",
  "email": "user@example.com",
  "role": "owner",
  "enabled": true
}
```

---

### GET /api/admin/fused-events

Get fused events for dashboard.

**Query Parameters:**

- `limit` (number): Max events to return (default: 20)
- `severity` (number): Min severity filter

**Response:**

```json
{
  "events": [
    {
      "id": "event-uuid",
      "ts": "2026-01-17T10:30:00Z",
      "title": "Event Title",
      "severity": 8,
      "severityBreakdown": {
        "scores": { "market": 85, "news": 75, "social": 60 },
        "confidence": 0.9,
        "finalScore": 76
      },
      "eventType": "fusion",
      "sentiment": "bearish",
      "symbols": ["AAPL"]
    }
  ]
}
```

---

## WebSocket Events

### Connection

```javascript
const ws = new WebSocket('wss://api.xxt-agent.com/ws');

ws.onopen = () => {
  // Subscribe to events
  ws.send(JSON.stringify({
    type: 'subscribe',
    topics: ['fused-events', 'quotes:AAPL']
  }));
};
```

### Event Types

| Type | Description |
|------|-------------|
| `fused-event` | New fused event created |
| `quote` | Quote update for symbol |
| `alert` | Alert notification |

**fused-event payload:**

```json
{
  "type": "fused-event",
  "data": {
    "id": "event-uuid",
    "title": "...",
    "severity": 8,
    "symbols": ["AAPL"]
  }
}
```

---

## Health Check

### GET /health

**Response:**

```json
{
  "status": "healthy",
  "service": "ai-gateway",
  "geminiReady": true,
  "timestamp": "2026-01-17T10:30:00Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

| HTTP Code | Description |
|-----------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Error - Server error |
| 503 | Service Unavailable - AI not ready |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| AI endpoints | 60 requests/minute |
| Admin endpoints | 120 requests/minute |
| WebSocket | 10 connections/user |
