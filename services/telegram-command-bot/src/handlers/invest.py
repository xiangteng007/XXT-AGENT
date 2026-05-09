"""
handlers/invest.py — Investment Brain handlers (v9.1)

Handles /analyze, /watch, /watchlist commands with audit logging.
Delegates heavy logic to main.py's existing analyze_via_gateway calls
while adding v9.1 Pub/Sub audit trail.
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..config import Settings

from ..tg_api import send_message
from ..investment_brain_client import analyze_via_gateway
from .audit import emit_cmd_audit

logger = logging.getLogger("telegram-command-bot.invest")


async def handle_analyze(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    store,
) -> None:
    """
    /analyze <SYM> — Triple Fusion deep analysis.
    Delegates to analyze_via_gateway and emits audit event.
    """
    if not args:
        await send_message(
            settings.telegram_bot_token, chat_id,
            "用法: /analyze <SYM>\n範例: /analyze TSMC"
        )
        return

    sym = args[0].upper()

    if not settings.openclaw_gateway_url:
        await send_message(settings.telegram_bot_token, chat_id, "❌ Gateway URL 未設定。")
        return

    # Emit audit event (non-blocking)
    asyncio.create_task(
        emit_cmd_audit(settings, chat_id, "/analyze", {"symbol": sym})
    )

    await send_message(
        settings.telegram_bot_token, chat_id,
        f"🤖 <b>[系統]</b> 啟動多智能體投資分析 (標的: {sym})...",
        parse_mode="HTML"
    )

    resp = await analyze_via_gateway(
        settings.openclaw_gateway_url,
        settings.internal_secret,
        sym,
        timeframe="15m",
    )

    if not resp.get("ok", True) and "error" in resp:
        await send_message(
            settings.telegram_bot_token, chat_id,
            f"❌ Analysis failed: {resp.get('error', 'unknown error')}"
        )
        return

    # ── 1. Nova (Market Analyst) ──────────────────────────────────
    market = resp.get("market_insight", {})
    if market:
        nova_msg = (
            f"🧠 <b>Nova (市場分析師)</b>:\n"
            f"體制: {market.get('regime', 'N/A')} | 趨勢: {market.get('trend', 'N/A')}\n"
            f"催化劑: {', '.join(market.get('catalysts', []))}"
        )
        await send_message(settings.telegram_bot_token, chat_id, nova_msg, parse_mode="HTML")
        await asyncio.sleep(1)

    # ── 2. Argus (Information Verifier) ──────────────────────────
    verification = resp.get("verification", {})
    if verification:
        credibility = verification.get("credibility_score", 50)
        status_icon = "🟢" if credibility >= 70 else ("🟡" if credibility >= 40 else "🔴")
        argus_msg = (
            f"👁️ <b>Argus (情報驗證員)</b>:\n"
            f"資訊可信度: {status_icon} {credibility}/100\n"
            f"情緒背離: {'⚠️ 是' if verification.get('sentiment_divergence') else '否'}\n"
            f"驗證摘要: {verification.get('summary', '無')}"
        )
        await send_message(settings.telegram_bot_token, chat_id, argus_msg, parse_mode="HTML")
        await asyncio.sleep(1)

    # ── 3. Guardian (Risk Manager) ────────────────────────────────
    risk = resp.get("risk_assessment", {})
    if risk:
        flags_text = (
            "\n".join([f"• {f}" for f in risk.get("risk_flags", [])[:3]])
            if risk.get("risk_flags") else "無特殊警告"
        )
        guardian_msg = (
            f"🛡️ <b>Guardian (風控專家)</b>:\n"
            f"風險評分: {risk.get('risk_score', 'N/A')}/100\n"
            f"警告事項:\n{flags_text}"
        )
        await send_message(settings.telegram_bot_token, chat_id, guardian_msg, parse_mode="HTML")
        await asyncio.sleep(1)

    # ── 4. Titan (Strategy Planner) ───────────────────────────────
    plan = resp.get("investment_plan", {})
    if plan:
        titan_msg = (
            f"⚡ <b>Titan (策略規劃師)</b>:\n"
            f"建議行動: {plan.get('action', 'N/A')} (信心: {plan.get('confidence_score', 0)}%)\n"
            f"進場: {plan.get('entry_price', 'N/A')} | "
            f"止損: {plan.get('stop_loss', 'N/A')} | "
            f"止盈: {plan.get('take_profit', 'N/A')}\n\n"
            f"判斷依據:\n{plan.get('basis_of_judgment', 'N/A')}\n\n"
            f"<i>{plan.get('advisory_disclaimer', '⚠️ 決策支援僅供參考，不構成投資建議。')}</i>"
        )
        await send_message(settings.telegram_bot_token, chat_id, titan_msg, parse_mode="HTML")


async def handle_watch(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    store,
) -> None:
    """/watch add/remove <SYM>"""
    if len(args) < 2:
        await send_message(
            settings.telegram_bot_token, chat_id,
            "用法: /watch add <SYM> 或 /watch remove <SYM>"
        )
        return

    action = args[0].lower()
    sym = args[1].upper()

    if action == "add":
        store.add(chat_id, sym)
        await send_message(
            settings.telegram_bot_token, chat_id,
            f"✅ Added <b>{sym}</b> to watchlist.", parse_mode="HTML"
        )
    elif action == "remove":
        store.remove(chat_id, sym)
        await send_message(
            settings.telegram_bot_token, chat_id,
            f"🗑 Removed <b>{sym}</b> from watchlist.", parse_mode="HTML"
        )
    else:
        await send_message(
            settings.telegram_bot_token, chat_id,
            "用法: /watch add <SYM> 或 /watch remove <SYM>"
        )


async def handle_watchlist(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    store,
) -> None:
    """/watchlist — show user watchlist"""
    items = store.list(chat_id)
    if items:
        await send_message(
            settings.telegram_bot_token, chat_id,
            "📌 <b>Your Watchlist:</b>\n" + "\n".join([f"• {s}" for s in items]),
            parse_mode="HTML"
        )
    else:
        await send_message(
            settings.telegram_bot_token, chat_id,
            "📌 Watchlist 為空。使用 /watch add <SYM> 新增標的。"
        )
