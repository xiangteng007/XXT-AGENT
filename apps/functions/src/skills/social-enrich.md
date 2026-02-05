# Skill: social-enrich

目標：使用 Gemini 進行社群貼文智能化處理

## Gemini 用途

1. 社群貼文 enrich（urgency/severity/entities/impactHint）
2. 新聞 enrich（severity/relatedSymbols/impactHint）
3. 融合摘要（rationale + impactHint）

## 輸出 JSON Schema（必須）

```json
{
  "severity": 70,
  "sentiment": "negative",
  "keywords": ["string"],
  "entities": [{"type": "ticker", "value": "2330"}],
  "impactHint": "string",
  "rationale": "string"
}
```

## 驗證規則（硬性）

- 必須使用 Zod 驗證
- 非 JSON 或不符 schema：拒絕並回退到規則引擎（fallback）
- severity 必須在 0-100 範圍
- sentiment 必須是 positive/negative/neutral

## 嚴重度評分標準

- 0-30：一般資訊，無緊急性
- 31-50：值得關注的事件
- 51-70：重要事件，需要追蹤
- 71-85：緊急事件，需要立即關注
- 86-100：危機等級，需要即刻行動
