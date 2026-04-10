"""
Market Analyst Agent Node

Consumes Triple Fusion data (market, news, social) and produces
a structured MarketInsight with regime classification, signals,
and conviction level.

Integration:
  - Event Fusion Engine (Redis shared state)
  - AI Gateway (Gemini for analysis)
  - Market Data (Yahoo Finance for candles)
"""
from __future__ import annotations

import logging
from datetime import datetime

from langchain_core.messages import AIMessage

from ..state import InvestmentAgentState, MarketInsight, PriceSnapshot, FusionContext
from ...tools.ai_gateway import ai_gateway
from ...tools.fusion_client import fusion_client
from ...tools.market_data import market_data

logger = logging.getLogger("investment-brain.nodes.market_analyst")

MARKET_ANALYST_SYSTEM_PROMPT = """你是 XXT-AGENT 投資分析系統的「市場分析師」(Market Analyst)。

你的職責是：
1. 分析三重融合數據（市場價格 + 新聞情緒 + 社群輿情）
2. 判斷當前市場體制 (regime)：bull / bear / range / volatile
3. 識別關鍵訊號和催化劑
4. 給出 conviction（信心度 0-100）

以 JSON 格式輸出：
{
  "regime": "bull|bear|range|volatile|unknown",
  "trend": "up|down|range",
  "signals": [
    {"type": "technical|fundamental|sentiment", "description": "...", "strength": 0-100}
  ],
  "conviction": 0-100,
  "key_levels": {
    "support": [價位],
    "resistance": [價位]
  },
  "catalysts": ["催化劑1", "催化劑2"],
  "summary": "一句話市場概覽（繁體中文）"
}

規則：
- 至少識別 2 個訊號
- conviction 反映你對趨勢判斷的信心
- 如果數據不足，regime 設為 "unknown"，conviction < 30
- 使用繁體中文撰寫 summary 和 catalysts"""


async def market_analyst_node(state: InvestmentAgentState) -> dict:
    """
    Market Analyst Agent — LangGraph node function.

    1. Fetches Triple Fusion context from Redis
    2. Fetches latest candles from market data
    3. Calls AI Gateway for structured analysis
    4. Returns MarketInsight
    """
    symbol = state["symbol"]
    timeframe = state.get("timeframe", "1h")

    logger.info(f"[Market Analyst] Analyzing {symbol} ({timeframe})")

    # ── Step 1: Get market data ────────────────────────────
    candles = await market_data.get_candles(symbol, interval="15m", range_str="5d")
    quote = await market_data.get_quote(symbol)

    price_snapshot: PriceSnapshot | None = None
    if quote:
        # Determine volatility regime
        vol_regime = "normal"
        if candles and len(candles) >= 20:
            closes = [c["close"] for c in candles[-60:]]
            if closes:
                mx, mn = max(closes), min(closes)
                if mn > 0:
                    rng = (mx - mn) / mn
                    vol_regime = "high" if rng > 0.03 else ("low" if rng < 0.01 else "normal")

        price_snapshot = PriceSnapshot(
            symbol=symbol,
            price=quote["price"],
            open=quote["open"],
            high=quote["high"],
            low=quote["low"],
            volume=quote["volume"],
            change_pct_1m=quote.get("change_pct", 0),
            volatility_regime=vol_regime,
            timestamp=quote.get("timestamp", datetime.utcnow().isoformat()),
        )

    # ── Step 2: Get Triple Fusion context ──────────────────
    fusion = await fusion_client.get_fusion_context(symbol)
    fusion_ctx: FusionContext = FusionContext(
        market=fusion.get("market", {}),
        news=fusion.get("news", {}),
        social=fusion.get("social", {}),
        severity=fusion.get("severity", 0),
        direction=fusion.get("direction", "unknown"),
    )

    # ── Step 3: Build analysis prompt ──────────────────────
    candle_summary = ""
    if candles:
        recent = candles[-30:]
        candle_summary = f"""
最近 {len(recent)} 根 K 線摘要（15 分鐘）:
- 最新價: {recent[-1]['close']}
- 最高: {max(c['high'] for c in recent)}
- 最低: {min(c['low'] for c in recent)}
- 均量: {sum(c['volume'] for c in recent) // len(recent)}
"""

    analysis_prompt = f"""
分析標的: {symbol}
時間框架: {timeframe}

{candle_summary}

三重融合數據:
- 新聞數量: {fusion['news']['count']}
- 新聞標題: {', '.join(fusion['news']['headlines'][:3]) or '無'}
- 社群訊號: {fusion['social']['count']} 則
- 嚴重度: {fusion['severity']}/100

{'即時報價: ' + str(quote) if quote else '即時報價不可用'}
"""

    # ── Step 4: Call AI Gateway ─────────────────────────────
    try:
        insight_data = await ai_gateway.generate_structured(
            prompt=analysis_prompt,
            system_prompt=MARKET_ANALYST_SYSTEM_PROMPT,
        )

        if insight_data.get("parse_error"):
            # Fallback: generate basic insight from available data
            insight_data = _build_fallback_insight(symbol, quote, candles, fusion)

    except Exception as e:
        logger.warning(f"[Market Analyst] AI Gateway failed: {e}, using fallback")
        insight_data = _build_fallback_insight(symbol, quote, candles, fusion)

    # ── Step 5: Build MarketInsight ────────────────────────
    market_insight = MarketInsight(
        regime=insight_data.get("regime", "unknown"),
        trend=insight_data.get("trend", "range"),
        signals=insight_data.get("signals", []),
        conviction=insight_data.get("conviction", 30),
        key_levels=insight_data.get("key_levels", {"support": [], "resistance": []}),
        catalysts=insight_data.get("catalysts", []),
        summary=insight_data.get("summary", f"{symbol} 分析完成"),
    )

    logger.info(
        f"[Market Analyst] {symbol}: regime={market_insight['regime']}, "
        f"conviction={market_insight['conviction']}"
    )

    return {
        "price_snapshot": price_snapshot,
        "fusion_context": fusion_ctx,
        "market_insight": market_insight,
        "current_step": "plan",
        "messages": [AIMessage(
            content=f"[Market Analyst] {symbol} 分析完成: "
                    f"regime={market_insight['regime']}, "
                    f"conviction={market_insight['conviction']}/100. "
                    f"{market_insight['summary']}",
            name="market_analyst",
        )],
    }


def _build_fallback_insight(
    symbol: str,
    quote: dict | None,
    candles: list[dict],
    fusion: dict,
) -> dict:
    """Build a basic market insight when AI is unavailable."""
    # Simple trend detection
    trend = "range"
    if candles and len(candles) >= 20:
        c0 = candles[0]["close"]
        cn = candles[-1]["close"]
        if cn > c0 * 1.01:
            trend = "up"
        elif cn < c0 * 0.99:
            trend = "down"

    regime = "unknown"
    if trend == "up":
        regime = "bull"
    elif trend == "down":
        regime = "bear"

    support = []
    resistance = []
    if candles:
        recent = candles[-60:]
        support = [min(c["low"] for c in recent)]
        resistance = [max(c["high"] for c in recent)]

    return {
        "regime": regime,
        "trend": trend,
        "signals": [
            {"type": "technical", "description": f"趨勢方向: {trend}", "strength": 50},
            {
                "type": "sentiment",
                "description": f"新聞數量: {fusion['news']['count']}",
                "strength": min(80, fusion["news"]["count"] * 15),
            },
        ],
        "conviction": 30,
        "key_levels": {"support": support, "resistance": resistance},
        "catalysts": fusion["news"]["headlines"][:2] or ["無即時催化劑"],
        "summary": f"{symbol} 處於 {regime} 狀態，信心度偏低（數據有限）",
    }
