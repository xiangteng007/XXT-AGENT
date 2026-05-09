# Fused Event Schema

> **最後更新**: 2026-05-04  
> **Schema Version**: v1.1

All upstream streams (market/news/social) should ultimately produce `fused_event`
and **push** it to Pub/Sub + Firestore (optional).

## Event Types

| eventType | Source | Description |
|:---|:---|:---|
| `fusion.market_impact.inferred` | Event Fusion Engine | Cross-source correlated market event |
| `fusion.news.analyzed` | News Collector + Gemini | AI-enriched news with sentiment |
| `fusion.social.detected` | Social Worker | Social media trend detected |
| `audit.command.executed` | Telegram Bot | Command audit trail |
| `audit.agent.response` | OpenClaw Gateway | Agent response audit |

## Minimal JSON (v1)

```json
{
  "id": "evt_20260115_031500_ab12",
  "ts": "2026-01-15T03:15:00+08:00",
  "tenantId": "default",
  "domain": "fusion",
  "eventType": "fusion.market_impact.inferred",
  "news_title": "（必填）新聞標題或事件標題",
  "severity": 82,
  "instrument": {
    "type": "stock|fund|future|fx|crypto",
    "symbol": "2330.TW",
    "name": "台積電"
  },
  "sentiment": "bullish|bearish|neutral|unknown",
  "impact_hypothesis": [
    "一句話影響推論（短）",
    "風險提示（短）"
  ],
  "evidence": [
    { "source": "news", "title": "xxx", "url": "https://...", "ts": "..." }
  ],
  "confidence": 0.62
}
```

## Notification Format (Hard Rule)

- Must include **title + severity**
- Example: `[SEV=82] 台南停電影響擴大（疑似主幹線跳脫）`

## Pub/Sub Topics

| Topic | Publisher | Subscriber |
|:---|:---|:---|
| `fused_event` | Event Fusion Engine | Notifier, Dashboard |
| `audit.log` | Telegram Bot, OpenClaw Gateway | (Planned: BigQuery) |
| `news.raw` | News Collector | Event Fusion Engine |
| `law.updates` | (Planned) | Regulation RAG |

## DLQ (Dead Letter Queue)

- **Endpoint**: `/dlq` on Event Fusion Engine
- **Action**: Failed events are re-published with Telegram alert to `ADMIN_CHAT_ID`
- **Format**: Direct Telegram message with event ID and error details

## Versioning Strategy

- Schema version is embedded as `schema_version` field (optional, defaults to `"1"`)
- Breaking changes increment major version and require consumer migration
- New optional fields are backward-compatible and do not increment version
