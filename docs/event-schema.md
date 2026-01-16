# fused_event schema (v1)

All upstream streams (market/news/social) should ultimately produce `fused_event`
and **push** it to Pub/Sub + Firestore (optional).

## Minimal JSON
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

## Notification format (hard rule)
- Must include **title + severity**
- Example:
`[SEV=82] 台南停電影響擴大（疑似主幹線跳脫）`
