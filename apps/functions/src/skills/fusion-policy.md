# Skill: fusion-policy

目標：將 social + news + market 在 5~10 分鐘滑動窗內融合成 fused_event

## 融合規則

### 1. 相關性判定

- **symbol match**：兩個事件都包含相同的 ticker/fund/future entity
- **topic overlap**：keywords 重疊 >= 2 個

### 2. 嚴重度計算

```
finalSeverity = max(input severities) + domainBonus
domainBonus = (domain_count - 1) * 10
```

範例：

- social(severity=60) + market(severity=70) → 70 + 10 = 80

### 3. 輸出 eventType

`fusion.market_impact.inferred`

### 4. 輸出格式

```json
{
  "domain": "fusion",
  "eventType": "fusion.market_impact.inferred",
  "title": "📊 2330: social+market 融合事件",
  "severity": 80,
  "direction": "negative",
  "entities": [...],
  "rationale": "融合 2 個事件 (social, market), 匹配類型: symbol",
  "impactHint": "高度關注：多來源確認的重要事件"
}
```

## impactHint 規則

- severity >= 70：「高度關注：多來源確認的重要事件」
- severity >= 50：「值得追蹤：跨領域相關事件」
- severity < 50：「資訊整合：多來源關聯資料」
