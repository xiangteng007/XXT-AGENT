# Skill: market-signals

目標：市場異常信號偵測

## 異常偵測類型（MVP）

1. **price_spike**：abs(changePct5m) >= threshold (default 1.5%)
2. **volume_spike**：volume >= avgVolume * factor (default 2.0)
3. **volatility_high**：ATR > threshold (default 2.0)

## 監控標的

- 股票 (stock)
- 基金 (fund)
- 期貨 (future)

## 信號輸出

```json
{
  "symbol": "2330",
  "signalType": "price_spike",
  "severity": 75,
  "direction": "positive|negative",
  "confidence": 0.85,
  "rationale": "5分鐘內上漲 2.3%",
  "riskControls": {
    "stopLoss": 585.0,
    "maxPositionPct": 20
  }
}
```

## 風險提示（硬性）

每則信號必須附加：

- 非投資建議
- 投資有風險，請謹慎評估
- 不可保證獲利
