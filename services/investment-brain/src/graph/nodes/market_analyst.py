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
    {"type": "technical|fundamental|sentiment", "description": "...", "strength": 0-100, "evidence": "引用具體數據點"}
  ],
  "conviction": 0-100,
  "key_levels": {
    "support": [價位],
    "resistance": [價位]
  },
  "catalysts": ["催化劑1", "催化劑2"],
  "summary": "一句話市場概覽（繁體中文）",
  "judgment_basis": "本分析依據以下數據形成判斷：...（列出 K 線型態、融合訊號、新聞標題等具體佐證）",
  "uncertainty_warning": "如果有任何數據缺失或信心度低，填寫不確定性警語（否則留空）"
}

規則：
- 至少識別 2 個訊號，每個訊號必須附帶 evidence 欄位（引用具體的 K 線數據、新聞標題或社群數據）
- conviction 反映你對趨勢判斷的信心
- 如果數據不足，regime 設為 "unknown"，conviction < 30
- judgment_basis 為必填欄位，必須用繁體中文列出你做出判斷所依據的 2-4 個核心數據點
- summary 必須包含具體數字（如價格、百分比變化、成交量）
- 使用繁體中文撰寫 summary、catalysts、judgment_basis、uncertainty_warning

⚠️ 低數據 Fallback 規則：
若三重融合數據不完整（例如新聞數量 = 0、社群訊號 = 0），你必須：
  1. 仍然輸出完整 JSON（不可省略任何欄位）
  2. 將 conviction 降低至 ≤ 25
  3. 在 summary 明確標註「⚠️ 數據不足，僅供參考」
  4. 必須填寫 uncertainty_warning 說明缺少哪些數據以及對分析的影響
  5. signals 至少保留技術面分析（K 線可獨立分析）"""


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
    fusion: dict = {}
    try:
        fusion = await fusion_client.get_fusion_context(symbol)
    except Exception as e:
        logger.warning(f"[Market Analyst] Fusion context fetch failed for {symbol}: {e}")

    # P1-04: Validate fusion structure — safe .get() with defaults
    fusion_news = fusion.get("news") if isinstance(fusion.get("news"), dict) else {}
    fusion_social = fusion.get("social") if isinstance(fusion.get("social"), dict) else {}
    fusion_market = fusion.get("market") if isinstance(fusion.get("market"), dict) else {}
    fusion_severity = fusion.get("severity", 0)
    if not isinstance(fusion_severity, (int, float)):
        logger.warning(f"[Market Analyst] fusion.severity is not numeric: {fusion_severity!r}")
        fusion_severity = 0

    fusion_ctx: FusionContext = FusionContext(
        market=fusion_market,
        news=fusion_news,
        social=fusion_social,
        severity=int(fusion_severity),
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

    # P1-04: Safe access for prompt construction
    news_count = fusion_news.get("count", 0) if isinstance(fusion_news.get("count"), int) else 0
    news_headlines = fusion_news.get("headlines", []) or []
    if not isinstance(news_headlines, list):
        news_headlines = []
    social_count = fusion_social.get("count", 0) if isinstance(fusion_social.get("count"), int) else 0

    analysis_prompt = f"""
分析標的: {symbol}
時間框架: {timeframe}

{candle_summary}

三重融合數據:
- 新聞數量: {news_count}
- 新聞標題: {', '.join(str(h) for h in news_headlines[:3]) or '無'}
- 社群訊號: {social_count} 則
- 嚴重度: {int(fusion_severity)}/100

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
        judgment_basis=insight_data.get("judgment_basis", "無明確判斷依據"),
        uncertainty_warning=insight_data.get("uncertainty_warning", ""),
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
            {"type": "technical", "description": f"趨勢方向: {trend}", "strength": 50, "evidence": f"基於最近 {len(candles)} 根 K 線的首尾價差"},
            {
                "type": "sentiment",
                "description": f"新聞數量: {fusion.get('news', {}).get('count', 0)}",
                "strength": min(80, fusion.get('news', {}).get('count', 0) * 15),
                "evidence": "來自 Triple Fusion 新聞計數"
            },
        ],
        "conviction": 25,
        "key_levels": {"support": support, "resistance": resistance},
        "catalysts": fusion.get("news", {}).get("headlines", [])[:2] or ["無即時催化劑"],
        "summary": f"⚠️ 數據來源不完整/AI離線。{symbol} 處於 {regime} 狀態，信心度偏低（數據有限）",
        "judgment_basis": f"基於 {len(candles)} 根 K 線的技術趨勢（AI 不可用，降級分析）",
        "uncertainty_warning": "⚠️ AI 分析引擎離線或數據不足，以下判斷僅供參考，請自行驗證"
    }
