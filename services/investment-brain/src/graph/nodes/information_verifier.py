"""
Information Verifier (Argus) Node

Takes FusionContext (News, Social) and MarketInsight (Technical) to cross-compare
and verify information. Detects discrepancies, fake hype, and confirms catalysts.

Integration:
  - AI Gateway (Gemini for analysis)
"""
from __future__ import annotations

import logging
from langchain_core.messages import AIMessage

from ..state import InvestmentAgentState, VerificationInsight
from ...tools.ai_gateway import ai_gateway

logger = logging.getLogger("investment-brain.nodes.information_verifier")

VERIFIER_SYSTEM_PROMPT = """你是 XXT-AGENT 系統的「OSINT 資訊驗證員」(Argus Verifier)。

你的職責是：
1. 交叉比對「市場技術分析(MarketInsight)」與「真實世界新聞、社群消息(FusionContext)」。
2. 找出潛在的假新聞 (Fake News) 或人為炒作 (Hype)。
3. 確認技術面是否與基本面/消息面相符（例如：技術面大漲，但新聞全都是負面的，這可能是誘多/異常）。
4. 計算量化的可信度分數和背離分數。
5. 輸出一個結構化的驗證報告 (VerificationInsight)。

以 JSON 格式輸出：
{
  "is_credible": true/false,
  "credibility_score": 0-100,
  "sentiment_divergence": true/false,
  "divergence_score": 0-100,
  "divergence_detail": "技術面顯示 X，但新聞/社群顯示 Y，兩者 Z 程度不一致",
  "verified_catalysts": ["確認的真實利好/利空 1", "確認的真實利好/利空 2"],
  "fake_or_hype_warnings": ["可能的假消息或過度炒作警告 1", "警告 2"],
  "source_reliability": {
    "news_quality": "high|medium|low|none",
    "social_quality": "high|medium|low|none",
    "cross_reference_count": 0
  },
  "summary": "一句話的驗證結論（繁體中文）",
  "judgment_basis": "本驗證結論依據以下交叉比對形成：1) [技術面 vs 新聞面] 2) [新聞面 vs 社群面] 3) [成交量/波動率佐證]",
  "credibility_basis": "針對不可信判定的具體衝突證據說明"
}

規則：
- 針對每個「不可信」或「背離」判定，必須在 credibility_basis 中列出至少 1 條具體的「衝突證據」。
- credibility_score 計算邏輯：
  • 基礎 50 分
  • 有 ≥2 條獨立新聞來源確認同一催化劑 → +20
  • 社群情緒與新聞方向一致 → +15
  • 技術面趨勢與消息面方向一致 → +15
  • 僅有單一來源或社群 → -10
  • 存在明顯假消息/炒作語言 → -20
- divergence_score 計算邏輯：
  • 0 = 完全一致
  • 100 = 嚴重背離（技術面與消息面方向完全相反）
  • >60 應觸發 sentiment_divergence = true
- 如果新聞和社群都是過度情緒化的字眼（例如 "to the moon"）但沒有實際新聞支持，請標記 fake_or_hype_warnings 並降低可信度。
- cross_reference_count = 多少個獨立來源互相印證
- judgment_basis 為必填欄位
- 始終使用繁體中文。"""

def compute_divergence_score(news_direction: str, social_direction: str, news_count: int, social_count: int) -> float:
    """
    Compute divergence score (0.0 to 1.0) between news and social directions.
    0.0 = total alignment, 1.0 = complete divergence.
    """
    if news_count == 0 and social_count == 0:
        return 0.0
    if news_count == 0 or social_count == 0:
        return 0.3  # Some uncertainty due to missing data from one side
        
    n_dir = news_direction.lower()
    s_dir = social_direction.lower()
    
    # If both are neutral/unknown or match perfectly
    if n_dir == s_dir:
        return 0.1
        
    # Opposing directions
    if (n_dir == "positive" and s_dir == "negative") or (n_dir == "negative" and s_dir == "positive"):
        return 0.8
        
    # One neutral, one directional
    return 0.4

async def information_verifier_node(state: InvestmentAgentState) -> dict:
    """
    Information Verifier Agent — LangGraph node function.

    1. Retrieves MarketInsight and FusionContext from state.
    2. Calls AI Gateway to cross-verify the data.
    3. Returns VerificationInsight.
    """
    symbol = state["symbol"]
    market_insight = state.get("market_insight")
    fusion_context = state.get("fusion_context")

    logger.info(f"[Information Verifier] Verifying intelligence for {symbol}")

    if not market_insight or not fusion_context:
        logger.warning(f"[Information Verifier] Missing context for {symbol}. Returning fallback.")
        return _build_fallback(symbol)

    insight_text = f"""
市場分析師技術判斷:
- 體制: {market_insight.get('regime', 'unknown')}
- 趨勢: {market_insight.get('trend', 'range')}
- 催化劑: {', '.join(market_insight.get('catalysts', []))}
"""

    news_data = fusion_context.get("news", {}).get("items", [])
    news_text = ""
    for idx, item in enumerate(news_data):
        news_text += f"新聞 {idx+1}: [{item.get('headline')}] - {item.get('summary', '')}\n"

    social_data = fusion_context.get("social", {}).get("items", [])
    social_text = ""
    for idx, item in enumerate(social_data):
        social_text += f"社群 {idx+1}: [{item.get('title')}] - {item.get('content', '')}\n"

    verification_prompt = f"""
分析標的: {symbol}

{insight_text}

最新新聞資料:
{news_text if news_text else "無新聞資料"}

最新社群資料:
{social_text if social_text else "無社群資料"}

請交叉對比技術面趨勢與消息面的實際內容，判斷目前的市場反應是否合理且可信。
"""

    try:
        verification_data = await ai_gateway.generate_structured(
            prompt=verification_prompt,
            system_prompt=VERIFIER_SYSTEM_PROMPT,
        )

        if verification_data.get("parse_error"):
            verification_data = _build_fallback(symbol).get("verification_insight", {})

    except Exception as e:
        logger.warning(f"[Information Verifier] AI Gateway failed: {e}, using fallback")
        verification_data = _build_fallback(symbol).get("verification_insight", {})

    # Compute programmatic divergence score
    n_dir = fusion_context.get("news", {}).get("direction", "unknown")
    s_dir = fusion_context.get("social", {}).get("direction", "unknown")
    n_cnt = fusion_context.get("news", {}).get("count", 0)
    s_cnt = fusion_context.get("social", {}).get("count", 0)
    prog_div_score = compute_divergence_score(n_dir, s_dir, n_cnt, s_cnt)

    # Use AI's divergence score if available, otherwise use programmatic
    ai_div_score = verification_data.get("divergence_score", prog_div_score * 100)
    div_score_float = ai_div_score / 100.0 if ai_div_score > 1 else ai_div_score

    verification_insight = VerificationInsight(
        is_credible=verification_data.get("is_credible", True),
        credibility_score=verification_data.get("credibility_score", 50),
        sentiment_divergence=verification_data.get("sentiment_divergence", False),
        divergence_score=div_score_float,
        divergence_detail=verification_data.get("divergence_detail", ""),
        verified_catalysts=verification_data.get("verified_catalysts", []),
        fake_or_hype_warnings=verification_data.get("fake_or_hype_warnings", []),
        source_reliability=verification_data.get("source_reliability", {}),
        summary=verification_data.get("summary", "驗證完成（無特別異常）。"),
        judgment_basis=verification_data.get("judgment_basis", ""),
        credibility_basis=verification_data.get("credibility_basis", ""),
    )

    logger.info(
        f"[Information Verifier] {symbol}: credible={verification_insight['is_credible']}, "
        f"divergence={verification_insight['sentiment_divergence']}"
    )

    return {
        "verification_insight": verification_insight,
        "current_step": "plan",
        "messages": [AIMessage(
            content=f"[Information Verifier] {symbol} 驗證完成: "
                    f"可信度={'高' if verification_insight['is_credible'] else '低'}, "
                    f"背離={'是' if verification_insight['sentiment_divergence'] else '否'}. "
                    f"{verification_insight['summary']}",
            name="information_verifier",
        )],
    }


def _build_fallback(symbol: str) -> dict:
    """Build a neutral fallback insight when AI is unavailable."""
    return {
        "verification_insight": {
            "is_credible": True,
            "credibility_score": 50,
            "sentiment_divergence": False,
            "divergence_score": 0.0,
            "divergence_detail": "無法比對",
            "verified_catalysts": [],
            "fake_or_hype_warnings": ["AI 驗證服務暫時不可用，無法進行交叉比對。"],
            "source_reliability": {},
            "summary": "AI 驗證服務暫時不可用，依賴原始數據。",
            "judgment_basis": "AI離線降級處理",
            "credibility_basis": "AI離線降級處理"
        },
        "current_step": "plan",
        "messages": [AIMessage(
            content=f"[Information Verifier] {symbol} 驗證服務暫時不可用。",
            name="information_verifier",
        )],
    }
