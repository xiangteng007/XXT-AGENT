"""
Telegram Command Bot — Main Entry Point

Cloud Run service that:
1. Receives Telegram webhook updates
2. Validates secret token header
3. Handles commands: /start, /help, /watch, /watchlist, /analyze,
   /reg, /ai, /system  (NemoClaw v2)
4. Calls trade-planner-worker for /analyze
"""
from __future__ import annotations

import json
import html
import re
import logging
from aiohttp import web, ClientSession, ClientTimeout

from .config import Settings
from .redis_watch import WatchStore
from .tg_api import send_message
from .investment_brain_client import analyze_via_gateway
import asyncio


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("telegram-command-bot")


def get_secret_header(request: web.Request) -> str:
    """Get Telegram webhook secret token from header."""
    return request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")


def parse_command(text: str) -> tuple[str, list[str]]:
    """Parse command and arguments from message text."""
    t = (text or "").strip()
    if not t:
        return "", []
    if not t.startswith("/"):
        return "NATURAL_LANGUAGE", [t]
    parts = t.split()
    cmd = parts[0].lower().split("@")[0]  # Handle /cmd@botname format
    args = parts[1:]
    return cmd, args


# format_analyze_result removed as we now use multi-agent streaming format.

def format_for_telegram(text: str) -> str:
    """Format Markdown text to Telegram-supported HTML."""
    if not text:
        return ""
    # Escape HTML to prevent Telegram parsing errors with arbitrary < >
    text = html.escape(text)
    
    # Code blocks (multi-line)
    text = re.sub(r'```[a-zA-Z0-9_-]*\n?(.*?)\n?```', r'<pre><code>\1</code></pre>', text, flags=re.DOTALL)
    
    # Code: `code` -> <code>code</code>
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    
    # Headers: ### Header -> <b>Header</b>
    text = re.sub(r'(?m)^###\s+(.+)$', r'<b>\1</b>', text)
    text = re.sub(r'(?m)^##\s+(.+)$', r'<b>\1</b>', text)
    text = re.sub(r'(?m)^#\s+(.+)$', r'<b>\1</b>', text)
    
    # Bold: **text** -> <b>text</b>
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    
    # Bold: __text__ -> <b>text</b>
    text = re.sub(r'__(.+?)__', r'<b>\1</b>', text)
    
    # Italic: *text* -> <i>text</i> (Be careful with list items)
    text = re.sub(r'(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)', r'<i>\1</i>', text)
    
    # Italic: _text_ -> <i>text</i>
    text = re.sub(r'(?<!_)_(?!\s)(.+?)(?<!\s)_(?!_)', r'<i>\1</i>', text)
    
    # Links: [text](url) -> <a href="url">text</a>
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    
    # Lists: - item or * item -> • item
    text = re.sub(r'(?m)^\s*[-*]\s+', r'• ', text)
    
    return text

async def call_agent_and_reply(gateway_url: str, bot_token: str, chat_id: str, agent_path: str, msg: str, prefix: str):
    """Helper to call OpenClaw gateway agent and send reply back to Telegram asynchronously."""
    if not gateway_url:
        await send_message(bot_token, chat_id, "❌ Gateway URL not configured.")
        return

    # Add hidden system instructions for better layout output on Telegram
    enhanced_msg = f"{msg}\n\n[系統內部提示：請務必使用條理分明的 Markdown 結構回答，並適度加入 Emoji 符號、粗體重點及清單排版，以利 Telegram 上清楚呈現。]"

    try:
        timeout = ClientTimeout(total=60)
        async with ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{gateway_url}{agent_path}",
                json={"message": enhanced_msg, "session_id": f"tg-{chat_id}"},
                headers={"Authorization": "Bearer dev-local-bypass"},
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    reply = data.get("reply") or data.get("answer") or "無回應"
                    reply = format_for_telegram(reply)
                    # Truncate if too long for Telegram (max 4096)
                    if len(reply) > 4000:
                        reply = reply[:4000] + "...\n(截斷)"
                    await send_message(bot_token, chat_id, f"{prefix}\n\n{reply}", parse_mode="HTML")
                else:
                    await send_message(bot_token, chat_id, f"❌ Gateway error: HTTP {resp.status}")
    except Exception as e:
        await send_message(bot_token, chat_id, f"❌ Request failed: {e}")

async def ollama_direct_reply(ollama_url: str, model: str, bot_token: str, chat_id: str, msg: str, prefix: str):
    """Helper to call Ollama directly for fallback chat."""
    if not ollama_url:
        await send_message(bot_token, chat_id, "❌ Ollama URL not configured.")
        return
    try:
        import re
        timeout = ClientTimeout(total=90)
        async with ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{ollama_url}/v1/chat/completions",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "你是使用者的專屬貼身管家，請用繁體中文禮貌、專業地回答。請務必使用條理分明的 Markdown 結構（如粗體、清單、段落）及適當的 Emoji 符號，以利閱讀。"},
                        {"role": "user", "content": msg + "\n/no_think"}
                    ],
                    "temperature": 0.3,
                    "stream": False,
                }
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    reply = data.get("choices", [{}])[0].get("message", {}).get("content", "無回應")
                    
                    # Remove <think> blocks if any
                    reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()
                    reply = format_for_telegram(reply)
                    
                    # Truncate if too long for Telegram (max 4096)
                    if len(reply) > 4000:
                        reply = reply[:4000] + "...\n(截斷)"
                        
                    await send_message(bot_token, chat_id, f"{prefix}\n\n{reply}", parse_mode="HTML")
                else:
                    await send_message(bot_token, chat_id, f"❌ Ollama error: HTTP {resp.status}")
    except Exception as e:
        await send_message(bot_token, chat_id, f"❌ Request failed: {e}")

async def process_update(update: dict, settings: Settings, store: WatchStore) -> None:
    """Process a single Telegram update."""

    if "callback_query" in update:
        cb = update["callback_query"]
        data = cb.get("data", "")
        msg = cb.get("message", {})
        chat_id = str(msg.get("chat", {}).get("id", ""))
        
        if data.startswith("agent_switch_"):
            agent_name = data.replace("agent_switch_", "")
            store.set_agent(chat_id, agent_name)
            
            token = settings.telegram_bot_token
            async with ClientSession(timeout=ClientTimeout(total=5)) as session:
                await session.post(
                    f"https://api.telegram.org/bot{token}/answerCallbackQuery",
                    json={"callback_query_id": cb["id"], "text": f"已切換至 {agent_name} 代理"}
                )
            await send_message(token, chat_id, f"✅ 已成功切換至 {agent_name} 代理。請輸入您的問題：")
        return

    msg = update.get("message") or update.get("edited_message") or {}
    chat = msg.get("chat") or {}
    chat_id = str(chat.get("id", ""))
    text = msg.get("text", "") or ""

    if not chat_id:
        return

    cmd, args = parse_command(text)
    
    # ── NATURAL LANGUAGE ROUTER (WAR ROOM LOBBY) ──
    if cmd == "NATURAL_LANGUAGE":
        user_text = args[0]
        if len(user_text) < 2:
            return
            
        current_agent = store.get_agent(chat_id)
        if current_agent != "butler":
            # Direct route to selected agent
            await send_message(settings.telegram_bot_token, chat_id, f"🤖 <b>[{current_agent}]</b> 收到訊息，處理中...", parse_mode="HTML")
            asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, f"/agents/{current_agent}/chat", user_text, f"🤖 <b>{current_agent} 回覆：</b>"))
            return
            
        await send_message(settings.telegram_bot_token, chat_id, "🤖 <b>[大廳管家]</b> 收到大廳訊息，意圖分發中...", parse_mode="HTML")
        
        try:
            timeout = ClientTimeout(total=20)
            async with ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{settings.ollama_base_url}/v1/chat/completions",
                    json={
                        "model": settings.ollama_model,
                        "messages": [
                            {"role": "system", "content": "你是一個意圖分發器。如果使用者的訊息與「股票、台積電、行情、分析」有關，回覆『INVEST: 股票代碼(若無明確代碼則輸出2330.TW或SPY)』。如果是會計、報稅，回覆『ACC』。如果是法規、法律，回覆『REG』。如果是保險，回覆『INS』。如果是貸款、融資，回覆『LOAN』。如果是個人資訊、公司資訊或客戶資訊，回覆『INFO』。如果是車輛保養資料，回覆『VEHICLE』。如果是工程進度、BIM或營造管理，回覆『ENG』。如果是行政事務、一般客服問題，回覆『ADMIN』。其他閒聊請回覆『CHAT』。"},
                            {"role": "user", "content": user_text + "\n/no_think"}
                        ],
                        "temperature": 0.1
                    }
                ) as resp_intent:
                    data = await resp_intent.json()
                    
            intent_result = data.get("choices", [{}])[0].get("message", {}).get("content", "CHAT").strip()
            
            if intent_result.startswith("INVEST:"):
                sym = intent_result.replace("INVEST:", "").strip()
                if not sym:
                    sym = "2330.TW"
                cmd = "/analyze"
                args = [sym]
            elif intent_result.startswith("ACC"):
                cmd = "/acc"
                args = [user_text]
            elif intent_result.startswith("REG"):
                cmd = "/reg"
                args = [user_text]
            elif intent_result.startswith("INS"):
                cmd = "/ins"
                args = [user_text]
            elif intent_result.startswith("LOAN"):
                cmd = "/loan"
                args = [user_text]
            elif intent_result.startswith("INFO"):
                cmd = "/info"
                args = [user_text]
            elif intent_result.startswith("VEHICLE"):
                cmd = "/vehicle"
                args = [user_text]
            elif intent_result.startswith("ENG"):
                cmd = "/eng"
                args = [user_text]
            elif intent_result.startswith("ADMIN"):
                cmd = "/admin"
                args = [user_text]
            else:
                cmd = "/ai"
                args = [user_text]
                
        except Exception as e:
            logger.error(f"Intent routing failed: {e}")
            import re
            if re.search(r'(2603|2330|股票|台積電|長榮|大盤|分析|行情|買|賣|線型|風險|財報)', user_text):
                match = re.search(r'\d{4}', user_text)
                sym = match.group(0) + ".TW" if match else "2330.TW"
                cmd = "/analyze"
                args = [sym]
            else:
                cmd = "/ai"
                args = [user_text]
    
    # /agents
    if cmd == "/agents":
        import json
        keyboard = {
            "inline_keyboard": [
                [{"text": "🤖 小秘書(預設)", "callback_data": "agent_switch_butler"}],
                [
                    {"text": "🏗️ Titan (建築/BIM)", "callback_data": "agent_switch_titan"},
                    {"text": "✨ Lumi (室內設計)", "callback_data": "agent_switch_lumi"}
                ],
                [
                    {"text": "📐 Rusty (估算工務)", "callback_data": "agent_switch_rusty"},
                    {"text": "💰 Accountant (財務)", "callback_data": "agent_switch_accountant"}
                ],
                [
                    {"text": "🛡️ Argus (資安情報)", "callback_data": "agent_switch_argus"},
                    {"text": "👩 Nova (人力營運)", "callback_data": "agent_switch_nova"}
                ],
                [
                    {"text": "📈 Investment (投資)", "callback_data": "agent_switch_investment"},
                    {"text": "⚙️ Forge (機電軟韌)", "callback_data": "agent_switch_forge"}
                ],
                [
                    {"text": "🔬 Matter (材料科學)", "callback_data": "agent_switch_matter"},
                    {"text": "☀️ Nexus (系統架構)", "callback_data": "agent_switch_nexus"}
                ],
                [
                    {"text": "🌱 Zenith (永續ESG)", "callback_data": "agent_switch_zenith"},
                    {"text": "🎯 Apex (行銷拓展)", "callback_data": "agent_switch_apex"}
                ],
                [
                    {"text": "⚖️ Vertex (法務合規)", "callback_data": "agent_switch_vertex"},
                    {"text": "📣 Echo (公關客服)", "callback_data": "agent_switch_echo"}
                ]
            ]
        }
        await send_message(
            settings.telegram_bot_token, 
            chat_id, 
            f"🤖 <b>AI 代理團隊</b>\n\n目前選擇的代理：<b>{store.get_agent(chat_id)}</b>\n\n請選擇您需要切換的專屬專家：",
            parse_mode="HTML",
            reply_markup=json.dumps(keyboard)
        )
        return

    # /start, /help
    if cmd in ("/help", "/start"):
        await send_message(
            settings.telegram_bot_token,
            chat_id,
            "🤖 <b>XXT-AGENT 總部大廳 (Lobby Portal)</b>\n\n"
            "<b>🤵 個人貼身管家 (Personal Butler)：</b>\n"
            "• /butler &lt;問題&gt; - 呼叫貼身管家為您服務\n\n"
            "<b>🏢 企業與個人管理 (Nova)：</b>\n"
            "• /info &lt;問題&gt; - 查詢客戶、公司與個人資訊\n"
            "• /vehicle &lt;問題&gt; - 查詢車輛保養資料\n\n"
            "<b>🏗️ 工程管理 (Titan, Rusty & Lumi)：</b>\n"
            "• /eng &lt;問題&gt; - 查詢工程進度、BIM與營造管理\n"
            "• /estimator &lt;問題&gt; - 查詢工程估算與計價\n"
            "• /interior &lt;問題&gt; - 查詢室內設計與裝潢建議\n\n"
            "<b>🚁 無人機任務 (Scout)：</b>\n"
            "• /scout &lt;問題&gt; - 無人機與飛行任務管理\n\n"
            "<b>⚖️ 法務與數據分析 (Lex, Sage & Zora)：</b>\n"
            "• /lex &lt;問題&gt; - 智財與合約法務諮詢\n"
            "• /sage &lt;問題&gt; - 數據分析與統計解讀\n"
            "• /zora &lt;問題&gt; - 企業社會責任與非營利參與\n\n"
            "<b>🛡️ 財務與保險 (Kay & Guardian)：</b>\n"
            "• /acc &lt;問題&gt; - 稅務/帳務自由問答\n"
            "• /loan &lt;問題&gt; - 貸款融資諮詢\n"
            "• /ins &lt;問題&gt; - 保單與保險諮詢\n\n"
            "<b>📊 市場分析 (Investment Brain)：</b>\n"
            "• /analyze &lt;SYM&gt; - Triple Fusion 深度分析\n"
            "• /watch add &lt;SYM&gt; - 追蹤股票\n"
            "• /watchlist - 查看監控清單\n\n"
            "<b>📚 法規查詢 (本地 RAG)：</b>\n"
            "• /reg &lt;問題&gt; - 全分類法規語義搜尋\n\n"
            "<b>💬 社群與其他功能：</b>\n"
            "• /agents - 切換對話專家代理(Agent)\n"
            "• /social [stats|top] - 社群信號與熱門話題掃描\n"
            "• /admin &lt;問題&gt; - 行政與一般客服問題\n"
            "• /ai &lt;問題&gt; - 本地 AI 自由問答 (Fallback)\n\n"
            "<b>⚙️ 系統狀態：</b>\n"
            "• /system - GPU / Ollama 狀態監控\n",
            parse_mode="HTML"
        )
        return

    # /social
    if cmd == "/social":
        sub = args[0].lower() if args else "stats"
        if sub == "stats":
            await send_message(settings.telegram_bot_token, chat_id, "📡 <b>Social Scan Stats</b>\n- Active Sources: 12\n- 24h Volume: 1,420 posts\n- Hot Topics: #TSMC, #NVIDIA", parse_mode="HTML")
        elif sub == "top":
            await send_message(settings.telegram_bot_token, chat_id, "🔥 <b>Top Social Signals</b>\n1. <b>TSMC</b>: Large sentiment spike on PTT\n2. <b>NVDA</b>: Earnings rumors on Twitter\n3. <b>AAPL</b>: Supply chain leak", parse_mode="HTML")
        else:
            await send_message(settings.telegram_bot_token, chat_id, "Usage: /social [stats|top]")
        return

    # /watch add/remove
    if cmd == "/watch" and len(args) >= 2:
        action = args[0].lower()
        sym = args[1].upper()

        if action == "add":
            store.add(chat_id, sym)
            await send_message(settings.telegram_bot_token, chat_id, f"✅ Added <b>{sym}</b> to watchlist.", parse_mode="HTML")
        elif action == "remove":
            store.remove(chat_id, sym)
            await send_message(settings.telegram_bot_token, chat_id, f"🗑 Removed <b>{sym}</b> from watchlist.", parse_mode="HTML")
        else:
            await send_message(settings.telegram_bot_token, chat_id, "Usage: /watch add <SYM> or /watch remove <SYM>")
        return

    # /watchlist
    if cmd == "/watchlist":
        items = store.list(chat_id)
        if items:
            await send_message(
                settings.telegram_bot_token,
                chat_id,
                "📌 <b>Your Watchlist:</b>\n" + "\n".join([f"• {s}" for s in items]),
                parse_mode="HTML"
            )
        else:
            await send_message(settings.telegram_bot_token, chat_id, "📌 Watchlist is empty. Use /watch add <SYM> to add symbols.")
        return

    # /analyze
    if cmd == "/analyze":
        if not args:
            await send_message(settings.telegram_bot_token, chat_id, "Usage: /analyze <SYM>")
            return
        
        sym = args[0].upper()
        
        if not settings.openclaw_gateway_url:
            await send_message(settings.telegram_bot_token, chat_id, "❌ Gateway URL not configured.")
            return

        await send_message(settings.telegram_bot_token, chat_id, f"🤖 <b>[系統]</b> 啟動多智能體投資分析 (標的: {sym})...", parse_mode="HTML")
        
        resp = await analyze_via_gateway(settings.openclaw_gateway_url, settings.internal_secret, sym, timeframe="15m")
        
        if not resp.get("ok", True) and "error" in resp:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ Analysis failed: {resp.get('error', 'unknown error')}")
            return
        
        # Simulation of agent message sequence
        
        # 1. Nova (Market Analyst)
        market = resp.get("market_insight", {})
        if market:
            nova_msg = (
                f"🧠 <b>Nova (市場分析師)</b>:\n"
                f"體制: {market.get('regime', 'N/A')} | 趨勢: {market.get('trend', 'N/A')}\n"
                f"催化劑: {', '.join(market.get('catalysts', []))}"
            )
            await send_message(settings.telegram_bot_token, chat_id, nova_msg, parse_mode="HTML")
            await asyncio.sleep(1)
            
        # 2. Argus (Information Verifier)
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
            
        # 3. Guardian (Risk Manager)
        risk = resp.get("risk_assessment", {})
        if risk:
            flags_text = "\n".join([f"• {f}" for f in risk.get('risk_flags', [])[:3]]) if risk.get('risk_flags') else "無特殊警告"
            guardian_msg = (
                f"🛡️ <b>Guardian (風控專家)</b>:\n"
                f"風險評分: {risk.get('risk_score', 'N/A')}/100\n"
                f"警告事項:\n{flags_text}"
            )
            await send_message(settings.telegram_bot_token, chat_id, guardian_msg, parse_mode="HTML")
            await asyncio.sleep(1)
            
        # 4. Titan (Strategy Planner)
        plan = resp.get("investment_plan", {})
        if plan:
            titan_msg = (
                f"⚡ <b>Titan (策略規劃師)</b>:\n"
                f"建議行動: {plan.get('action', 'N/A')} (信心: {plan.get('confidence_score', 0)}%)\n"
                f"進場: {plan.get('entry_price', 'N/A')} | 止損: {plan.get('stop_loss', 'N/A')} | 止盈: {plan.get('take_profit', 'N/A')}\n\n"
                f"判斷依據:\n{plan.get('basis_of_judgment', 'N/A')}\n\n"
                f"<i>{plan.get('advisory_disclaimer', '⚠️ 決策支援僅供參考，不構成投資建議。')}</i>"
            )
            await send_message(settings.telegram_bot_token, chat_id, titan_msg, parse_mode="HTML")

    # /info — 企業與個人管理 (Nova)
    if cmd == "/info":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "🏢 <b>Nova (行政客服)</b>\n收到您的資訊查詢請求，正在為您檢索 CRM 系統...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/nova/chat", f"[查詢客戶與公司資訊] {user_msg}", "🏢 <b>Nova (行政客服) 回覆：</b>"))
        return

    # /vehicle — 車輛保養資料
    if cmd == "/vehicle":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "🚗 <b>Nova (總務代理)</b>\n正在為您查詢車輛保養與調度資料...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/nova/chat", f"[查詢車輛保養與調度] {user_msg}", "🚗 <b>Nova (總務代理) 回覆：</b>"))
        return

    # /eng — 工程與營造管理 (Titan/Rusty)
    if cmd == "/eng":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "🏗️ <b>Titan & Rusty (工程管理)</b>\n收到您的工程查詢請求，正在檢索 BIM 與估算資料...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/bim/chat", f"[工程管理查詢] {user_msg}", "🏗️ <b>Titan (BIM/工程管理) 回覆：</b>"))
        return

    # /estimator — 工程估算與計價 (Rusty)
    if cmd == "/estimator":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "🏗️ <b>Rusty (估算與計價)</b>\n收到您的估算請求，正在檢索數量與價格資料...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/estimator/chat", f"[估算與計價] {user_msg}", "🏗️ <b>Rusty (估算與計價) 回覆：</b>"))
        return

    # /interior — 室內設計與裝潢 (Lumi)
    if cmd == "/interior":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "🏗️ <b>Lumi (室內設計)</b>\n收到您的設計查詢，正在為您提供裝潢建議...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/interior/chat", f"[室內設計與裝潢] {user_msg}", "🏗️ <b>Lumi (室內設計) 回覆：</b>"))
        return

    # /scout — 無人機任務
    if cmd == "/scout":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "🚁 <b>Scout (無人機任務)</b>\n收到任務指令，正在調度無人機系統...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/scout/chat", f"[無人機任務] {user_msg}", "🚁 <b>Scout (無人機任務) 回覆：</b>"))
        return

    # /lex — 法務諮詢
    if cmd == "/lex":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "⚖️ <b>Lex (法務諮詢)</b>\n收到您的法務問題，正在為您檢閱合約與智財資料...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/lex/chat", f"[法務諮詢] {user_msg}", "⚖️ <b>Lex (法務諮詢) 回覆：</b>"))
        return

    # /sage — 數據分析
    if cmd == "/sage":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "⚖️ <b>Sage (數據分析)</b>\n收到您的數據需求，正在進行統計與解讀...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/sage/chat", f"[數據分析] {user_msg}", "⚖️ <b>Sage (數據分析) 回覆：</b>"))
        return

    # /zora — CSR 與非營利
    if cmd == "/zora":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "⚖️ <b>Zora (CSR 與非營利)</b>\n收到您的 CSR 查詢，正在提供企業社會責任計畫建議...", parse_mode="HTML")
        asyncio.create_task(call_agent_and_reply(settings.openclaw_gateway_url, settings.telegram_bot_token, chat_id, "/agents/zora/chat", f"[CSR 與非營利] {user_msg}", "⚖️ <b>Zora (CSR 與非營利) 回覆：</b>"))
        return

    # /butler — 個人貼身管家
    if cmd == "/butler":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "🤵 <b>貼身管家</b>\n收到您的請求，正在為您處理...", parse_mode="HTML")
        asyncio.create_task(ollama_direct_reply(settings.ollama_base_url, settings.ollama_model, settings.telegram_bot_token, chat_id, user_msg, "🤵 <b>貼身管家 回覆：</b>"))
        return

    # /admin — 行政事務、一般客服
    if cmd == "/admin":
        await handle_admin(args, chat_id, settings)
        return

    # /ai — 本地 AI 自由問答 (Fallback)
    if cmd == "/ai":
        user_msg = " ".join(args)
        await send_message(settings.telegram_bot_token, chat_id, "🤖 <b>[系統]</b> 已將您的一般諮詢轉交給貼身管家處理中...", parse_mode="HTML")
        asyncio.create_task(ollama_direct_reply(settings.ollama_base_url, settings.ollama_model, settings.telegram_bot_token, chat_id, user_msg, "🤵 <b>貼身管家 回覆：</b>"))
        return

    # /reg — 法規查詢
    if cmd == "/reg":
        await send_message(settings.telegram_bot_token, chat_id, "📚 <b>[系統]</b> 法規查詢功能 (RAG) 正在建置中，請稍候...", parse_mode="HTML")
        return

    # /loan — 融鑫財務顧問（Finance，NemoClaw PRIVATE 本地推理）
    if cmd == "/loan":
        await handle_loan(args, chat_id, settings)
        return

    # /ins — 安盾保險顧問（Guardian，NemoClaw PRIVATE 本地推理）
    if cmd == "/ins":
        await handle_ins(args, chat_id, settings)
        return

    # /acc — 會計師幕僚（鳴鑫，NemoClaw PRIVATE 本地推理）
    if cmd == "/acc":
        ACC_SUBCOMMANDS = {
            "invoice", "payment", "tax", "ledger", "report", "export", "help",
            "bank", "entity", "taxplan",  # Phase 2
            "summary", "cats", "accounts",  # Phase 3
        }
        sub = args[0].lower() if args else ""
        sub_args = args[1:]

        if sub == "help" or not sub:
            await send_message(
                settings.telegram_bot_token, chat_id,
                "🦦 <b>Kay 🦦 稅務暨財務合規顧問（本地 AI，資料不出境）</b>\n\n"
                "<b>💬 問答：</b>\n"
                "• /acc &lt;問題&gt; — 稅務/帳務自由問答\n\n"
                "<b>🧮 快捷計算：</b>\n"
                "• /acc invoice &lt;含稅金額&gt; — 發票拆算\n"
                "• /acc tax personal &lt;年收入&gt; [扶養] — 個人所得稅\n"
                "• /acc tax corporate &lt;年所得&gt; — 公司所得稅\n"
                "• /acc tax labor &lt;月薪&gt; — 勞健保費用\n\n"
                "<b>📒 帳本操作：</b>\n"
                "• /acc ledger add &lt;income|expense&gt; &lt;科目&gt; &lt;金額&gt; &lt;摘要&gt; — 新增記錄\n"
                "• /acc ledger [YYYYMM] — 查詢本期/指定期間收支明細\n"
                "• /acc report &lt;YYYYMM&gt; — 期間收支彙總\n"
                "• /acc report 401 &lt;YYYYMM&gt; — 輸出 401 营業稅申報表\n"
                "• /acc export &lt;YYYYMM&gt; — 匯出 CSV 收支明細\n\n"
                "<b>範例：</b>\n"
                "  /acc 如何申報統一發票？\n"
                "  /acc invoice 105000\n"
                "  /acc ledger add income engineering_payment 210000 台積電備料款\n"
                "  /acc ledger 202601\n"
                "  /acc report 202601\n"
                "  /acc export 202601",
                parse_mode="HTML"
            )
            return

        # /acc invoice <amount>
        if sub == "invoice":
            if not sub_args:
                await send_message(settings.telegram_bot_token, chat_id, "用法: /acc invoice <金額>")
                return
            try:
                amount = float(sub_args[0].replace(",", ""))
            except ValueError:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 金額格式錯誤，請輸入數字")
                return

            tax_type = "taxed" if len(sub_args) < 2 or sub_args[1].lower() != "untaxed" else "untaxed"
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{settings.openclaw_gateway_url}/agents/accountant/invoice",
                        json={"amount": amount, "type": tax_type},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_acc:
                        data = await resp_acc.json()

                c = data["calculation"]
                text = (
                    f"🦉 <b>發票計算 — Kay 🦦</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"輸入金額: NT$ {c['input_amount']:,.0f}（{'含稅' if tax_type == 'taxed' else '未稅'}）\n\n"
                    f"📊 <b>拆解結果（稅率 {c['tax_rate_pct']}%）：</b>\n"
                    f"  未稅金額 = NT$ {c['untaxed_amount']:,.0f}\n"
                    f"  營業稅   = NT$ {c['tax_amount']:,.0f}\n"
                    f"  含稅合計 = NT$ {c['taxed_amount']:,.0f}\n\n"
                    f"📋 <b>建議開立：</b>\n  {data['invoice_suggestion']}\n\n"
                    f"⚖️ {data['legal_basis']}"
                )
                await send_message(settings.telegram_bot_token, chat_id, text, parse_mode="HTML")

            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 計算失敗: {e}")
            return

        # /acc tax <type> <amount> [param]
        if sub == "tax":
            if len(sub_args) < 2:
                await send_message(settings.telegram_bot_token, chat_id,
                    "用法: /acc tax personal <年收入> [扶養人數]\n"
                    "      /acc tax corporate <年所得>\n"
                    "      /acc tax labor <月薪>")
                return
            tax_type_arg = sub_args[0].lower()
            try:
                amount_arg = float(sub_args[1].replace(",", ""))
                dep_arg = int(sub_args[2]) if len(sub_args) > 2 else 0
            except (ValueError, IndexError):
                await send_message(settings.telegram_bot_token, chat_id, "❌ 金額格式錯誤")
                return

            tax_map = {"personal": "personal", "corporate": "corporate", "labor": "labor"}
            if tax_type_arg not in tax_map:
                await send_message(settings.telegram_bot_token, chat_id, "類型請輸入: personal / corporate / labor")
                return

            await send_message(settings.telegram_bot_token, chat_id, "🦉 計算稅額中...")
            try:
                timeout = ClientTimeout(total=15)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{settings.openclaw_gateway_url}/agents/accountant/tax",
                        json={"type": tax_map[tax_type_arg], "annual_income": amount_arg, "dependents": dep_arg},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_tax:
                        data = await resp_tax.json()

                if tax_type_arg == "personal":
                    txt = (
                        f"🦉 <b>個人所得稅試算 — Kay 🦦</b>\n"
                        f"━━━━━━━━━━━━━━━\n"
                        f"年收入: NT$ {data['annual_income']:,.0f}\n"
                        f"扣除額合計: NT$ {data['deductions']['total']:,.0f}\n"
                        f"應納稅所得額: NT$ {data['taxable_income']:,.0f}\n\n"
                        f"💰 <b>預估應納稅額: NT$ {data['estimated_tax']:,.0f}</b>\n"
                        f"📊 有效稅率: {data['effective_rate']}\n\n"
                        f"⚖️ {data['legal_basis']}\n"
                        f"⚠️ {data['note']}"
                    )
                elif tax_type_arg == "corporate":
                    txt = (
                        f"🦉 <b>公司所得稅試算 — Kay 🦦</b>\n"
                        f"━━━━━━━━━━━━━━━\n"
                        f"年所得: NT$ {data['annual_income']:,.0f}\n"
                        f"起徵點: NT$ {data['basic_threshold']:,.0f}\n"
                        f"應稅所得: NT$ {data['taxable_income']:,.0f}\n"
                        f"稅率: {data['tax_rate']}\n\n"
                        f"💰 <b>預估稅額: NT$ {data['estimated_tax']:,.0f}</b>\n\n"
                        f"⚖️ {data['legal_basis']}"
                    )
                else:  # labor
                    emp = data["costs"]["employer"]
                    ee = data["costs"]["employee"]
                    txt = (
                        f"🦉 <b>勞健保費用試算 — 鳴鑫</b>\n"
                        f"━━━━━━━━━━━━━━━\n"
                        f"月薪: NT$ {data['monthly_salary']:,.0f}\n\n"
                        f"🏢 <b>雇主負擔：</b>\n"
                        f"  勞保: NT$ {emp['labor_insurance']:,.0f}\n"
                        f"  健保: NT$ {emp['health_insurance']:,.0f}\n"
                        f"  勞退: NT$ {emp['labor_pension']:,.0f}\n"
                        f"  小計: NT$ {emp['total']:,.0f}\n\n"
                        f"👤 <b>員工負擔：</b>\n"
                        f"  勞保: NT$ {ee['labor_insurance']:,.0f}\n"
                        f"  健保: NT$ {ee['health_insurance']:,.0f}\n"
                        f"  小計: NT$ {ee['total']:,.0f}\n\n"
                        f"💰 <b>每月總人力成本: NT$ {data['total_labor_cost']:,.0f}</b>"
                    )
                await send_message(settings.telegram_bot_token, chat_id, txt, parse_mode="HTML")

            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 稅務計算失敗: {e}")
            return

        # /acc ledger add <income|expense> <category> <amount> <description>
        # /acc ledger [YYYYMM]  — 查詢收支明細
        if sub == "ledger":
            action = sub_args[0].lower() if sub_args else ""

            if action == "add":
                # 格式: /acc ledger add <income|expense> <科目> <金額> <摘要> [entity]
                # entity: company(預設) | personal | family
                ADD_INCOME_CATS = {
                    # 公司
                    "engineering_payment", "advance_payment", "design_fee",
                    "consulting_fee", "material_rebate", "other_income",
                    # 個人
                    "salary", "freelance", "rental_income", "investment_gain",
                    # 家庭
                    "allowance",
                }
                ADD_EXPENSE_CATS = {
                    # 公司
                    "material", "labor", "subcontract", "equipment", "overhead",
                    "insurance", "tax_payment", "utilities", "rent", "office_supply",
                    "entertainment", "transportation", "professional_service", "other_expense",
                    # 家庭（綜所稅扣除額）
                    "medical", "education", "life_insurance", "house_rent", "family_living",
                }
                ENTITY_CATS = {
                    "personal": {"salary", "freelance", "rental_income", "investment_gain"},
                    "family": {"allowance", "medical", "education", "life_insurance", "house_rent", "family_living"},
                }
                if len(sub_args) < 5:
                    await send_message(
                        settings.telegram_bot_token, chat_id,
                        "📒 <b>新增收支記錄</b>\n\n"
                        "格式: /acc ledger add &lt;income|expense&gt; &lt;科目&gt; &lt;金額&gt; &lt;摘要&gt; [entity]\n"
                        "entity: company（預設）| personal | family\n\n"
                        "<b>🏢 公司收入:</b> engineering_payment, advance_payment, design_fee, consulting_fee, other_income\n"
                        "<b>👤 個人收入:</b> salary, freelance, rental_income, investment_gain\n"
                        "<b>🏠 家庭撥款:</b> allowance\n\n"
                        "<b>🏢 公司支出:</b> material, labor, subcontract, equipment, overhead, insurance, rent, utilities, entertainment, transportation, professional_service\n"
                        "<b>🏠 家庭扣除:</b> medical, education, life_insurance, house_rent, family_living\n\n"
                        "<b>範例：</b>\n"
                        "  /acc ledger add income engineering_payment 1050000 台積電工程款\n"
                        "  /acc ledger add income salary 80000 一月薪資 personal\n"
                        "  /acc ledger add expense medical 50000 住院費 family\n"
                        "  /acc ledger add expense material 420000 鋼筋採購",
                        parse_mode="HTML"
                    )
                    return

                entry_type = sub_args[1].lower()
                category_arg = sub_args[2].lower()
                try:
                    amount_val = float(sub_args[3].replace(",", ""))
                except ValueError:
                    await send_message(settings.telegram_bot_token, chat_id, "❌ 金額格式錯誤，請輸入正整數（例：80000）")
                    return

                # 最後一個 arg 如果是 entity，取出
                remaining = sub_args[4:]
                entity_arg = "company"
                if remaining and remaining[-1].lower() in ("company", "personal", "family"):
                    entity_arg = remaining[-1].lower()
                    remaining = remaining[:-1]
                description_val = " ".join(remaining).strip() if remaining else sub_args[4] if len(sub_args) > 4 else ""
                if not description_val:
                    await send_message(settings.telegram_bot_token, chat_id, "❌ 請加入摘要說明")
                    return

                if entry_type not in ("income", "expense"):
                    await send_message(settings.telegram_bot_token, chat_id, "❌ 類型請輸入 income（收入）或 expense（支出）")
                    return

                valid_cats = ADD_INCOME_CATS if entry_type == "income" else ADD_EXPENSE_CATS
                if category_arg not in valid_cats:
                    # 建議科目
                    cat_type_list = ", ".join(sorted(valid_cats)[:8]) + "..."
                    await send_message(
                        settings.telegram_bot_token, chat_id,
                        f"❌ 科目 <code>{category_arg}</code> 不正確\n"
                        f"常用{'收入' if entry_type == 'income' else '支出'}科目：\n{cat_type_list}\n\n"
                        f"💡 /acc cats 查詢完整科目",
                        parse_mode="HTML"
                    )
                    return

                # 自動推斷實體（科目屬於個人/家庭時自動修正）
                auto_entity = entity_arg
                for ent, cats in ENTITY_CATS.items():
                    if category_arg in cats and entity_arg == "company":
                        auto_entity = ent
                        break

                try:
                    timeout = ClientTimeout(total=15)
                    async with ClientSession(timeout=timeout) as session:
                        async with session.post(
                            f"{settings.openclaw_gateway_url}/agents/accountant/ledger",
                            json={
                                "type": entry_type,
                                "category": category_arg,
                                "amount": amount_val,
                                "amount_type": "taxed",
                                "description": description_val,
                                "entity_type": auto_entity,
                            },
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_l:
                            data_l = await resp_l.json()

                    s = data_l.get("summary", {})
                    type_zh = "💰 收入" if entry_type == "income" else "💸 支出"
                    entity_icons = {"company": "🏢", "personal": "👤", "family": "🏠"}
                    ent_zh = {"company": "公司", "personal": "個人", "family": "家庭"}.get(auto_entity, auto_entity)
                    ent_icon = entity_icons.get(auto_entity, "📊")
                    auto_note = f"\n⚡ 自動歸類為{ent_zh}帳（科目屬{ent_zh}）" if auto_entity != entity_arg else ""
                    await send_message(
                        settings.telegram_bot_token, chat_id,
                        f"✅ <b>帳本記錄完成 — 鳴鑫</b>\n"
                        f"━━━━━━━━━━━━━━━\n"
                        f"{ent_icon} {ent_zh} | {type_zh} | {s.get('category', category_arg)}\n"
                        f"摘要: {s.get('description', description_val)}\n"
                        f"未稅: NT$ {s.get('amount_untaxed', 0):,.0f}\n"
                        f"稅額: NT$ {s.get('tax_amount', 0):,.0f}\n"
                        f"含稅: NT$ {s.get('amount_taxed', 0):,.0f}\n"
                        f"申報期間: {s.get('period', '')}\n"
                        f"交易日期: {s.get('transaction_date', '')}"
                        f"{auto_note}\n\n"
                        f"🔒 <i>本地儲存 | PRIVATE</i>",
                        parse_mode="HTML"
                    )
                except Exception as e:
                    await send_message(settings.telegram_bot_token, chat_id, f"❌ 記錄失敗: {e}")
                return

            # /acc ledger [YYYYMM] — 查詢明細
            else:
                period_arg = action if action and action.isdigit() and len(action) == 6 else None
                try:
                    timeout = ClientTimeout(total=15)
                    url = f"{settings.openclaw_gateway_url}/agents/accountant/ledger"
                    params_q: dict = {"limit": "20"}
                    if period_arg:
                        params_q["period"] = period_arg

                    async with ClientSession(timeout=timeout) as session:
                        async with session.get(
                            url,
                            params=params_q,
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_q:
                            data_q = await resp_q.json()

                    entries = data_q.get("entries", [])
                    summary_q = data_q.get("summary", {})
                    period_label = f"（{period_arg}期）" if period_arg else "（近期）"

                    lines = [f"📒 <b>收支明細 {period_label}</b>"]
                    lines.append(
                        f"收入: NT$ {summary_q.get('total_income', 0):,.0f} | "
                        f"支出: NT$ {summary_q.get('total_expense', 0):,.0f} | "
                        f"淨額: NT$ {summary_q.get('net', 0):,.0f}"
                    )
                    lines.append("━━━━━━━━━━━━━━━")

                    ent_icons2 = {"company": "🏢", "personal": "👤", "family": "🏠"}
                    if not entries:
                        lines.append("⚠️ 本期尚無記錄")
                    else:
                        for e in entries[:10]:
                            icon = "💰" if e["type"] == "income" else "💸"
                            ent_tag = ent_icons2.get(e.get("entity_type", "company"), "📊")
                            lines.append(
                                f"{icon}{ent_tag} {e['transaction_date']} {e['category']}\n"
                                f"   {e['description'][:30]} NT$ {e['amount_taxed']:,.0f}"
                            )
                        if len(entries) > 10:
                            lines.append(f"\n...共 {data_q['count']} 筆（顯示前10筆）")

                    await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines), parse_mode="HTML")
                except Exception as e:
                    await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
                return

        # /acc report <YYYYMM>          — 期間收支彙總
        # /acc report 401 <YYYYMM>      — 401 申報表格式
        if sub == "report":
            if not sub_args:
                await send_message(
                    settings.telegram_bot_token, chat_id,
                    "用法: /acc report &lt;YYYYMM&gt;\n"
                    "      /acc report 401 &lt;YYYYMM&gt;\n"
                    "範例: /acc report 202601\n"
                    "      /acc report 401 202601",
                    parse_mode="HTML"
                )
                return

            is_401 = sub_args[0].lower() == "401"
            period_arg = sub_args[1] if is_401 and len(sub_args) > 1 else sub_args[0]

            if not period_arg.isdigit() or len(period_arg) != 6:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 期間格式錯誤，請使用 YYYYMM（例: 202601）")
                return

            await send_message(settings.telegram_bot_token, chat_id, f"📊 產生{'401申報' if is_401 else '彙總'}報表中...")

            try:
                timeout = ClientTimeout(total=20)
                async with ClientSession(timeout=timeout) as session:
                    if is_401:
                        async with session.get(
                            f"{settings.openclaw_gateway_url}/agents/accountant/report/401",
                            params={"period": period_arg},
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_r:
                            data_r = await resp_r.json()
                        report = data_r.get("report", {})
                        h = report.get("header", {})
                        s1 = report.get("section_1_sales", {})
                        s2 = report.get("section_2_purchases", {})
                        s3 = report.get("section_3_tax_calculation", {})
                        txt = (
                            f"📋 <b>401 營業稅申報書</b>\n"
                            f"━━━━━━━━━━━━━━━\n"
                            f"公司: {h.get('company_name', '')}\n"
                            f"統編: {h.get('tax_id', '（未填）')}\n"
                            f"申報期間: {h.get('tax_period', '')}\n"
                            f"申報截止: {h.get('filing_deadline', '')}\n\n"
                            f"<b>壹、銷售額（收入）</b>\n"
                            f"  應稅銷售: NT$ {s1.get('taxable_sales_standard', 0):,.0f}\n"
                            f"  銷項稅額: NT$ {s1.get('tax_output', 0):,.0f}\n\n"
                            f"<b>貳、進項稅額（支出）</b>\n"
                            f"  應稅進貨: NT$ {s2.get('taxable_purchases', 0):,.0f}\n"
                            f"  可扣抵進項: NT$ {s2.get('deductible_tax', 0):,.0f}\n\n"
                            f"<b>參、應納（退）稅額</b>\n"
                            f"  銷項稅: NT$ {s3.get('output_tax', 0):,.0f}\n"
                            f"  進項扣抵: NT$ {s3.get('deductible_input_tax', 0):,.0f}\n"
                            f"  <b>應繳稅額: NT$ {s3.get('net_tax_payable', 0):,.0f}</b>\n"
                            f"  退稅金額: NT$ {s3.get('refund_amount', 0):,.0f}\n\n"
                            f"⚠️ <i>{data_r.get('disclaimer', '請核對後申報')}</i>"
                        )
                    else:
                        async with session.get(
                            f"{settings.openclaw_gateway_url}/agents/accountant/report/summary",
                            params={"period": period_arg},
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_r:
                            data_r = await resp_r.json()
                        txt = (
                            f"📊 <b>{data_r.get('period_label', period_arg)} 收支彙總</b>\n"
                            f"━━━━━━━━━━━━━━━\n"
                            f"💰 總收入（未稅）: NT$ {data_r.get('total_income_untaxed', 0):,.0f}\n"
                            f"💸 總支出（未稅）: NT$ {data_r.get('total_expense_untaxed', 0):,.0f}\n"
                            f"📈 損益: NT$ {data_r.get('net_profit_loss', 0):,.0f}\n\n"
                            f"🏦 銷項稅額: NT$ {data_r.get('total_tax_output', 0):,.0f}\n"
                            f"🔄 進項稅額（可扣）: NT$ {data_r.get('total_tax_input', 0):,.0f}\n"
                            f"💳 <b>應繳/退稅: NT$ {data_r.get('net_tax_payable', 0):,.0f}</b>\n\n"
                            f"📋 記錄數: {data_r.get('entry_count', 0)} 筆\n"
                            f"💡 輸出完整 401 表：/acc report 401 {period_arg}"
                        )

                await send_message(settings.telegram_bot_token, chat_id, txt, parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 報表產生失敗: {e}")
            return

        # /acc export <YYYYMM> — CSV 匯出（以文字訊息回傳純文字 CSV 或提示下載連結）
        if sub == "export":
            if not sub_args or not sub_args[0].isdigit() or len(sub_args[0]) != 6:
                await send_message(
                    settings.telegram_bot_token, chat_id,
                    "用法: /acc export &lt;YYYYMM&gt;\n"
                    "範例: /acc export 202601",
                    parse_mode="HTML"
                )
                return

            period_arg = sub_args[0]
            await send_message(settings.telegram_bot_token, chat_id, f"📥 產生 {period_arg} 期收支 CSV 中...")

            try:
                timeout = ClientTimeout(total=20)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{settings.openclaw_gateway_url}/agents/accountant/export/csv",
                        params={"period": period_arg},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_csv:
                        if resp_csv.status != 200:
                            raise RuntimeError(f"HTTP {resp_csv.status}")
                        csv_content = await resp_csv.text()

                # 預覽前5行（含標頭）
                csv_lines = csv_content.strip().split("\n")
                preview = "\n".join(csv_lines[:6])
                total = len(csv_lines) - 1  # 減去標頭

                await send_message(
                    settings.telegram_bot_token, chat_id,
                    f"📥 <b>收支明細 CSV（{period_arg}期）</b>\n"
                    f"共 {total} 筆記錄\n\n"
                    f"<code>{preview[:800]}</code>\n\n"
                    f"💡 完整下載：\n"
                    f"<code>GET {settings.openclaw_gateway_url}/agents/accountant/export/csv?period={period_arg}</code>\n"
                    f"（需附 Authorization header）",
                    parse_mode="HTML"
                )
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ CSV 匯出失敗: {e}")
            return


        # ── Phase 2: /acc bank ─────────────────────────────────────────
        if sub == "bank":
            bank_action = sub_args[0].lower() if sub_args else ""

            if bank_action == "add":
                if len(sub_args) < 4:
                    await send_message(
                        settings.telegram_bot_token, chat_id,
                        "🏦 <b>新增銀行帳戶</b>\n\n"
                        "格式: /acc bank add &lt;銀行名稱&gt; &lt;後4碼&gt; &lt;戶名&gt; [company|personal|family]\n\n"
                        "<b>範例：</b>\n"
                        "  /acc bank add 台灣銀行 1234 SENTENG建工 company\n"
                        "  /acc bank add 合作金庫 5678 王小明 personal\n"
                        "  /acc bank add 第一銀行 9012 家用帳戶 family",
                        parse_mode="HTML"
                    )
                    return
                bank_name = sub_args[1]
                acct_last4 = sub_args[2]
                holder = sub_args[3]
                entity = sub_args[4].lower() if len(sub_args) > 4 else "company"
                if entity not in ("company", "personal", "family"):
                    entity = "company"
                try:
                    timeout = ClientTimeout(total=10)
                    async with ClientSession(timeout=timeout) as session:
                        async with session.post(
                            f"{settings.openclaw_gateway_url}/agents/accountant/bank/account",
                            json={"bank_name": bank_name, "account_no": acct_last4,
                                  "account_holder": holder, "entity_type": entity,
                                  "currency": "TWD", "current_balance": 0},
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_b:
                            data_b = await resp_b.json()
                    entity_zh = {"company": "🏢 公司", "personal": "👤 個人", "family": "🏠 家庭"}.get(entity, entity)
                    await send_message(
                        settings.telegram_bot_token, chat_id,
                        f"✅ <b>銀行帳戶已新增</b>\n━━━━━━━━━━━━━━━\n"
                        f"銀行: {bank_name}\n帳號: ****{acct_last4}\n戶名: {holder}\n實體: {entity_zh}\n\n"
                        f"💡 記錄往來: /acc bank txn {acct_last4} credit 100000 工程款\n"
                        f"🔒 <i>PRIVATE | 資料不出境</i>",
                        parse_mode="HTML"
                    )
                except Exception as e:
                    await send_message(settings.telegram_bot_token, chat_id, f"❌ 新增失敗: {e}")
                return

            elif bank_action == "txn":
                if len(sub_args) < 5:
                    await send_message(
                        settings.telegram_bot_token, chat_id,
                        "💳 <b>記錄銀行往來</b>\n\n"
                        "格式: /acc bank txn &lt;後4碼&gt; &lt;credit|debit&gt; &lt;金額&gt; &lt;摘要&gt; [科目]\n\n"
                        "常用科目：engineering_payment | material | salary | medical | family_living\n\n"
                        "<b>範例：</b>\n"
                        "  /acc bank txn 1234 credit 1050000 台積電工程款 engineering_payment\n"
                        "  /acc bank txn 5678 credit 80000 1月薪資 salary",
                        parse_mode="HTML"
                    )
                    return
                acct4 = sub_args[1]
                txn_type = sub_args[2].lower()
                try:
                    txn_amount = float(sub_args[3].replace(",", ""))
                except ValueError:
                    await send_message(settings.telegram_bot_token, chat_id, "❌ 金額格式錯誤")
                    return
                txn_desc = sub_args[4]
                txn_cat = sub_args[5].lower() if len(sub_args) > 5 else None
                if txn_type not in ("credit", "debit"):
                    await send_message(settings.telegram_bot_token, chat_id, "❌ 類型請輸入 credit（存入）或 debit（提出）")
                    return
                payload = {"account_no_masked": acct4, "type": txn_type,
                           "amount": txn_amount, "description": txn_desc}
                if txn_cat:
                    payload["ledger_category"] = txn_cat
                try:
                    timeout = ClientTimeout(total=12)
                    async with ClientSession(timeout=timeout) as session:
                        async with session.post(
                            f"{settings.openclaw_gateway_url}/agents/accountant/bank/txn",
                            json=payload,
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_t:
                            data_t = await resp_t.json()
                    s = data_t.get("summary", {})
                    type_zh = "💰 存入" if txn_type == "credit" else "💸 提出"
                    synced_txt = f"\n📒 已同步帳本（{txn_cat}）" if data_t.get("dual_write") else ""
                    await send_message(
                        settings.telegram_bot_token, chat_id,
                        f"✅ <b>銀行往來記錄完成</b>\n━━━━━━━━━━━━━━━\n"
                        f"帳戶: {s.get('bank', acct4)}\n實體: {s.get('entity', '')}\n"
                        f"{type_zh}: NT$ {txn_amount:,.0f}\n摘要: {txn_desc}\n日期: {s.get('txn_date', '')}"
                        f"{synced_txt}\n\n🔒 <i>PRIVATE</i>",
                        parse_mode="HTML"
                    )
                except Exception as e:
                    await send_message(settings.telegram_bot_token, chat_id, f"❌ 記錄失敗: {e}")
                return

            elif bank_action == "history":
                acct4 = sub_args[1] if len(sub_args) > 1 else ""
                period_h = sub_args[2] if len(sub_args) > 2 and sub_args[2].isdigit() and len(sub_args[2]) == 6 else None
                params_h = {"account_no_masked": acct4, "limit": "20"}
                if period_h:
                    params_h["period"] = period_h
                try:
                    timeout = ClientTimeout(total=12)
                    async with ClientSession(timeout=timeout) as session:
                        async with session.get(
                            f"{settings.openclaw_gateway_url}/agents/accountant/bank/txn",
                            params=params_h,
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_h:
                            data_h = await resp_h.json()
                    txns = data_h.get("transactions", [])
                    period_label = f"（{period_h}期）" if period_h else "（近期）"
                    lines = [f"🏦 <b>銀行往來 ****{acct4} {period_label}</b>",
                             f"存入 NT${data_h.get('total_credit',0):,.0f} | 提出 NT${data_h.get('total_debit',0):,.0f} | 淨額 NT${data_h.get('net',0):,.0f}",
                             "━━━━━━━━━━━━━━━"]
                    if not txns:
                        lines.append("⚠️ 尚無往來記錄")
                    else:
                        for t in txns[:10]:
                            icon = "💰" if t["type"] == "credit" else "💸"
                            synced = " ✓" if t.get("linked_entry_id") else ""
                            lines.append(f"{icon} {t['txn_date']} NT${t['amount']:,.0f} {t['description'][:20]}{synced}")
                    await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines), parse_mode="HTML")
                except Exception as e:
                    await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
                return

            else:
                # /acc bank → 餘額總覽
                try:
                    timeout = ClientTimeout(total=10)
                    async with ClientSession(timeout=timeout) as session:
                        async with session.get(
                            f"{settings.openclaw_gateway_url}/agents/accountant/bank/balance",
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_bal:
                            data_bal = await resp_bal.json()
                    grand = data_bal.get("grand_total_twd", 0)
                    lines = ["🏦 <b>銀行帳戶餘額總覽</b>", "━━━━━━━━━━━━━━━"]
                    has_accounts = False
                    for ent_data in data_bal.get("by_entity", []):
                        if not ent_data.get("accounts"):
                            continue
                        has_accounts = True
                        lines.append(f"\n<b>{ent_data['entity_label']} NT${ent_data['total_balance']:,.0f}</b>")
                        for a in ent_data["accounts"]:
                            lines.append(f"  🏦 {a['bank_name']} ****{a['account_no_masked']} | {a['account_holder']} | NT${a['current_balance']:,.0f}")
                    if not has_accounts:
                        lines.append("⚠️ 尚無帳戶\n💡 /acc bank add 台灣銀行 1234 SENTENG company")
                    else:
                        lines.append(f"\n━━━━━━━━━━━━━━━\n💰 <b>合計: NT$ {grand:,.0f}</b>")
                    lines.append("\n🔒 <i>PRIVATE | 帳號後四碼顯示</i>")
                    await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines), parse_mode="HTML")
                except Exception as e:
                    await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
                return

        # ── /acc entity <company|personal|family|all> [YYYYMM] ─────────
        if sub == "entity":
            entity_arg = sub_args[0].lower() if sub_args else "all"
            if entity_arg not in ("company", "personal", "family", "all"):
                entity_arg = "all"
            period_e = sub_args[1] if len(sub_args) > 1 and len(sub_args[1]) == 6 and sub_args[1].isdigit() else None
            year_e = sub_args[1] if len(sub_args) > 1 and len(sub_args[1]) == 4 and sub_args[1].isdigit() else None
            params_e = {}
            if entity_arg != "all":
                params_e["entity"] = entity_arg
            if period_e:
                params_e["period"] = period_e
            elif year_e:
                params_e["year"] = year_e
            await send_message(settings.telegram_bot_token, chat_id, "📊 分析各實體收支中...")
            try:
                timeout = ClientTimeout(total=15)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{settings.openclaw_gateway_url}/agents/accountant/report/entity",
                        params=params_e,
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_e:
                        data_e = await resp_e.json()
                icons = {"company": "🏢", "personal": "👤", "family": "🏠"}
                lines_e = ["📈 <b>多實體收支報表</b>", "━━━━━━━━━━━━━━━"]
                for ent in data_e.get("entities", []):
                    ico = icons.get(ent["entity_type"], "📊")
                    lines_e.append(
                        f"\n{ico} <b>{ent['entity_label']} {ent.get('period','')} "
                        f"({ent['entry_count']}筆)</b>\n"
                        f"  💰 收入 NT${ent['total_income']:,.0f} | 💸 支出 NT${ent['total_expense']:,.0f}\n"
                        f"  📈 損益 NT${ent['net_profit_loss']:,.0f} | 稅差 NT${ent['net_tax']:,.0f}"
                    )
                    if ent["entity_type"] == "family" and ent.get("deductible_items"):
                        lines_e.append("  📋 可申報：" + " | ".join(f"{d['category']} NT${d['amount']:,.0f}" for d in ent["deductible_items"]))
                    if ent.get("top_categories"):
                        lines_e.append("  Top: " + " | ".join(f"{k}: NT${v:,.0f}" for k, v in ent["top_categories"][:3]))
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_e), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
            return

        # ── /acc taxplan [year|deduct] ─────────────────────────────────
        if sub == "taxplan":
            taxplan_arg = sub_args[0].lower() if sub_args else ""
            if taxplan_arg == "deduct":
                await send_message(settings.telegram_bot_token, chat_id, "📋 查詢可申報扣除額中...")
                try:
                    timeout = ClientTimeout(total=15)
                    async with ClientSession(timeout=timeout) as session:
                        async with session.post(
                            f"{settings.openclaw_gateway_url}/agents/accountant/taxplan",
                            json={"mode": "deduct"},
                            headers={"Authorization": "Bearer dev-local-bypass"},
                        ) as resp_d:
                            data_d = await resp_d.json()
                    cat_labels = {"medical": "醫療費", "education": "子女教育費",
                                  "life_insurance": "壽險費", "house_rent": "租屋費"}
                    lines_d = [f"📋 <b>可申報扣除額（{data_d.get('year')}年）</b>", "━━━━━━━━━━━━━━━"]
                    for d in data_d.get("deductions", []):
                        st = "✅" if d["actual"] >= d["limit"] else "⚠️" if d["actual"] > 0 else "❌"
                        lines_d.append(
                            f"{st} {cat_labels.get(d['category'], d['category'])}\n"
                            f"   已記NT${d['actual']:,.0f} → 可申NT${d['claimable']:,.0f}（上限{d['limit']:,.0f}）"
                        )
                    total_ded = data_d.get("total_deductible", 0)
                    lines_d.extend([f"\n━━━━━━━━━━━━━━━", f"💳 <b>合計可申報: NT$ {total_ded:,.0f}</b>",
                                    f"\n<i>{data_d.get('note','')}</i>"])
                    await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_d), parse_mode="HTML")
                except Exception as e:
                    await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
                return

            year_tp = int(taxplan_arg) if taxplan_arg.isdigit() and len(taxplan_arg) == 4 else None
            await send_message(
                settings.telegram_bot_token, chat_id,
                f"🧠 鳴鑫節稅規劃{'（' + str(year_tp) + '年）'if year_tp else '（當年度）'}分析中...\n"
                "⏳ AI 掃描三實體帳本 + 法規 RAG，約需 20-40 秒 🔒"
            )
            try:
                import re as _re
                timeout = ClientTimeout(total=90)
                payload_tp = {}
                if year_tp:
                    payload_tp["year"] = year_tp
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{settings.openclaw_gateway_url}/agents/accountant/taxplan",
                        json=payload_tp,
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_tp:
                        data_tp = await resp_tp.json()

                plan = _re.sub(r"<think>.*?</think>", "", data_tp.get("plan", ""), flags=0x10).strip()
                latency_tp = data_tp.get("latency_ms", 0)
                ds = data_tp.get("data_summary", {})
                co = ds.get("company", {}); pe = ds.get("personal", {}); fa = ds.get("family", {})
                header = (
                    f"🦉 <b>鳴鑫節稅規劃 {data_tp.get('year')}年度</b>\n━━━━━━━━━━━━━━━\n"
                    f"🏢 公司損益 NT${co.get('net',0):,.0f} | 👤 個人所得 NT${pe.get('income',0):,.0f}\n"
                    f"🏠 家庭可申報扣除 NT${fa.get('deductible_total',0):,.0f}\n━━━━━━━━━━━━━━━\n\n"
                )
                full_text = header + plan[:3200]
                full_text += (f"\n\n⚠️ <i>{data_tp.get('disclaimer','')}</i>\n"
                              f"<i>⏱ {latency_tp:.0f}ms | 🔒 本地推理 | PRIVATE</i>")
                await send_message(settings.telegram_bot_token, chat_id, full_text, parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 節稅規劃失敗: {e}")
            return


        # ── /acc summary — 全局一覽儀表板 ────────────────────────────
        if sub == "summary":
            await send_message(settings.telegram_bot_token, chat_id, "📊 載入財務儀表板中...")
            from datetime import datetime as _dt
            now = _dt.now()
            current_period = now.strftime("%Y%m")
            current_year = now.year
            try:
                import asyncio as _asyncio
                timeout = ClientTimeout(total=20)
                async with ClientSession(timeout=timeout) as session:
                    # 並行查詢：餘額 + 當期收支 + 實體比較
                    tasks = [
                        session.get(f"{settings.openclaw_gateway_url}/agents/accountant/bank/balance",
                                    headers={"Authorization": "Bearer dev-local-bypass"}),
                        session.get(f"{settings.openclaw_gateway_url}/agents/accountant/report/entity",
                                    params={"year": str(current_year)},
                                    headers={"Authorization": "Bearer dev-local-bypass"}),
                        session.get(f"{settings.openclaw_gateway_url}/agents/accountant/ledger",
                                    params={"period": current_period, "limit": "5"},
                                    headers={"Authorization": "Bearer dev-local-bypass"}),
                    ]
                    resp_bal, resp_ent, resp_led = await _asyncio.gather(*tasks)
                    bal_data = await resp_bal.json()
                    ent_data = await resp_ent.json()
                    led_data = await resp_led.json()

                # === 銀行餘額 ===
                grand_total = bal_data.get("grand_total_twd", 0)
                bank_lines = [f"💰 銀行合計: NT$ {grand_total:,.0f}"]
                for ent_b in bal_data.get("by_entity", []):
                    if ent_b.get("accounts"):
                        icons2 = {"company": "🏢", "personal": "👤", "family": "🏠"}
                        bank_lines.append(
                            f"{icons2.get(ent_b['entity_type'],'📊')} {ent_b['entity_label']}: "
                            f"NT$ {ent_b['total_balance']:,.0f}"
                        )

                # === 各實體收支 ===
                ent_lines = []
                total_income_all = 0
                total_expense_all = 0
                for ent_e in ent_data.get("entities", []):
                    icons2 = {"company": "🏢", "personal": "👤", "family": "🏠"}
                    ico = icons2.get(ent_e["entity_type"], "📊")
                    net = ent_e["net_profit_loss"]
                    net_str = f"+NT${net:,.0f}" if net >= 0 else f"-NT${abs(net):,.0f}"
                    ent_lines.append(f"{ico} {ent_e['entity_label']}: 收NT${ent_e['total_income']:,.0f} 支NT${ent_e['total_expense']:,.0f} 淨{net_str}")
                    total_income_all += ent_e["total_income"]
                    total_expense_all += ent_e["total_expense"]

                # === 最近記錄 ===
                recent_entries = led_data.get("entries", [])[:3]
                recent_lines = []
                ent_icons3 = {"company": "🏢", "personal": "👤", "family": "🏠"}
                for e in recent_entries:
                    ico2 = "💰" if e["type"] == "income" else "💸"
                    ent_tag = ent_icons3.get(e.get("entity_type", "company"), "📊")
                    recent_lines.append(f"{ico2}{ent_tag} {e['transaction_date'][:10]} {e['description'][:20]} NT${e['amount_taxed']:,.0f}")

                msg = (
                    f"📊 <b>財務一覽 {current_year}年 {current_period}期</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"🏦 <b>銀行帳戶</b>\n" +
                    "\n".join(bank_lines) +
                    f"\n\n📈 <b>年度收支（三實體合計）</b>\n"
                    f"  收入: NT$ {total_income_all:,.0f}\n"
                    f"  支出: NT$ {total_expense_all:,.0f}\n"
                    f"  淨額: NT$ {(total_income_all-total_expense_all):,.0f}\n" +
                    "\n".join(ent_lines) +
                    (f"\n\n📋 <b>最近交易（{current_period}期）</b>\n" + "\n".join(recent_lines) if recent_lines else "") +
                    f"\n\n━━━━━━━━━━━━━━━\n"
                    f"💡 /acc entity all | /acc bank | /acc taxplan\n"
                    f"🔒 <i>PRIVATE</i>"
                )
                await send_message(settings.telegram_bot_token, chat_id, msg, parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 儀表板載入失敗: {e}")
            return

        # ── /acc cats — 完整科目速查 ──────────────────────────────────
        if sub == "cats":
            cat_type = sub_args[0].lower() if sub_args else "all"
            msg_cats = (
                "📋 <b>鳴鑫帳本科目速查</b>\n"
                "━━━━━━━━━━━━━━━\n\n"
                "🏢 <b>公司收入 (income + company)</b>\n"
                "  engineering_payment — 工程款（請款）\n"
                "  advance_payment     — 工程預付款\n"
                "  design_fee          — 設計費\n"
                "  consulting_fee      — 顧問費\n"
                "  material_rebate     — 材料退佣\n"
                "  other_income        — 其他收入\n\n"
                "👤 <b>個人收入 (income + personal)</b>\n"
                "  salary              — 薪資所得\n"
                "  freelance           — 自由業所得\n"
                "  rental_income       — 租金收入\n"
                "  investment_gain     — 投資收益\n\n"
                "🏠 <b>家庭撥款 (income + family)</b>\n"
                "  allowance           — 家用撥款\n\n"
                "━━━━━━━━━━━━━━━\n\n"
                "🏢 <b>公司支出 (expense + company)</b>\n"
                "  material            — 材料費\n"
                "  labor               — 人工費\n"
                "  subcontract         — 外包/分包款\n"
                "  equipment           — 機具設備\n"
                "  overhead            — 管銷費用\n"
                "  insurance           — 保險費\n"
                "  tax_payment         — 稅款繳納\n"
                "  utilities           — 水電費\n"
                "  rent                — 公司租金\n"
                "  office_supply       — 辦公用品\n"
                "  entertainment       — 交際費\n"
                "  transportation      — 交通費\n"
                "  professional_service — 會計/法務費\n"
                "  other_expense       — 其他支出\n\n"
                "🏠 <b>家庭扣除額 (expense + family)</b>\n"
                "  medical             — 醫療費（上限 NT$200,000）\n"
                "  education           — 子女教育費（上限 NT$25,000/人）\n"
                "  life_insurance      — 壽險費（上限 NT$24,000/人）\n"
                "  house_rent          — 租屋費（上限 NT$120,000）\n"
                "  family_living       — 家庭生活費\n\n"
                "━━━━━━━━━━━━━━━\n"
                "💡 /acc ledger add income salary 80000 一月薪資 personal"
            )
            await send_message(settings.telegram_bot_token, chat_id, msg_cats, parse_mode="HTML")
            return

        # ── /acc accounts — 列出所有銀行帳戶（別名 /acc bank 的帳戶列表）──
        if sub == "accounts":
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{settings.openclaw_gateway_url}/agents/accountant/bank/accounts",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_a:
                        data_a = await resp_a.json()
                accounts_list = data_a.get("accounts", [])
                if not accounts_list:
                    await send_message(
                        settings.telegram_bot_token, chat_id,
                        "🏦 <b>銀行帳戶列表</b>\n\n⚠️ 尚未登錄任何帳戶\n\n"
                        "💡 新增: /acc bank add 台灣銀行 1234 SENTENG company",
                        parse_mode="HTML"
                    )
                    return
                ent_icons4 = {"company": "🏢", "personal": "👤", "family": "🏠"}
                lines_a = [f"🏦 <b>銀行帳戶列表（{data_a.get('count', 0)}個）</b>", "━━━━━━━━━━━━━━━"]
                for a in accounts_list:
                    ico = ent_icons4.get(a.get("entity_type", "company"), "📊")
                    active = "✅" if a.get("is_active") else "❌"
                    lines_a.append(
                        f"{active} {ico} {a['bank_name']} ****{a['account_no_masked']}\n"
                        f"   {a['account_holder']} | NT$ {a['current_balance']:,.0f} | {a['entity_label']}"
                    )
                lines_a.append("\n💡 往來記錄: /acc bank txn <後4碼> credit <金額> <摘要>")
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_a), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢帳戶失敗: {e}")
            return

        # /acc <自由問題> — 呼叫 qwen3:14b 會計師問答
        question = " ".join(args).strip()
        if not question:
            question = "你好，請問你能幫我處理哪些會計問題？"

        await send_message(settings.telegram_bot_token, chat_id, "🦉 鳴鑫會計師思考中...")
        try:
            import re as _re
            timeout = ClientTimeout(total=90)
            async with ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{settings.openclaw_gateway_url}/agents/accountant/chat",
                    json={"message": question},
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_chat:
                    chat_data = await resp_chat.json()

            reply = chat_data.get("reply", "無法取得回答")
            reply = _re.sub(r"<think>.*?</think>", "", reply, flags=0x10).strip()
            reply = format_for_telegram(reply)
            latency = chat_data.get("latency_ms", 0)

            await send_message(
                settings.telegram_bot_token, chat_id,
                f"🦉 <b>鳴鑫會計師</b>\n\n{reply[:3500]}\n\n"
                f"<i>⏱ {latency:.0f}ms | 🔒 本地推理 | PRIVATE</i>",
                parse_mode="HTML"
            )
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 連線異常: {e}")
        return

    # /reg — 法規語義搜尋（NemoClaw Layer 4）
    if cmd == "/reg":
        VALID_CATS = {"building", "fire", "tax", "cns", "labor"}
        category: str | None = None
        query_parts = args

        if args and args[0].lower() in VALID_CATS:
            category = args[0].lower()
            query_parts = args[1:]

        query = " ".join(query_parts).strip()
        if not query:
            await send_message(
                settings.telegram_bot_token, chat_id,
                "ℹ️ 用法: /reg [分類] 查詢問題\n"
                "分類: building / fire / tax / cns / labor\n"
                "範例: /reg building 住宅建蔽率限制\n"
                "       /reg 統一發票申報期限"
            )
            return

        await send_message(settings.telegram_bot_token, chat_id, f"🔍 搜尋法規: {query}...")

        try:
            timeout = ClientTimeout(total=20)
            payload: dict = {"query": query, "top_k": 4}
            if category:
                payload["category"] = category

            async with ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{settings.regulation_rag_url}/query",
                    json=payload,
                ) as resp_r:
                    if resp_r.status != 200:
                        raise RuntimeError(f"RAG HTTP {resp_r.status}")
                    data = await resp_r.json()

            results = data.get("results", [])
            if not results:
                await send_message(settings.telegram_bot_token, chat_id,
                    f"⚠️ 未找到相關法條: 「{query}」"
                )
                return

            cat_label = f"[{category}] " if category else ""
            lines = [f"📚 <b>{cat_label}法規查詢: {query}</b>\n"]
            for i, r in enumerate(results[:3], 1):
                score_pct = int(r['score'] * 5)
                score_bar = "█" * score_pct + "░" * (5 - score_pct)
                content_preview = r['content'][:200] + ("..." if len(r['content']) > 200 else "")
                lines.append(
                    f"📌 <b>{r['source']}</b> [{score_bar}]\n"
                    f"<i>{content_preview}</i>\n"
                )

            lines.append(f"\n⏱ {data.get('latency_ms', 0):.0f}ms | "
                         f"🧠 {data.get('embed_model', 'nomic-embed-text')}")

            await send_message(settings.telegram_bot_token, chat_id,
                "\n".join(lines), parse_mode="HTML")

        except Exception as e:
            logger.error(f"/reg error: {e}")
            await send_message(settings.telegram_bot_token, chat_id,
                f"❌ 法規服務異常: {e}\n請確認 Regulation RAG 服務已啟動")

        return

    # The /ai block was moved to line 462

    # /system — GPU / Ollama 狀態
    if cmd == "/system":
        try:
            timeout = ClientTimeout(total=8)
            async with ClientSession(timeout=timeout) as session:
                async with session.get(
                    f"{settings.openclaw_gateway_url}/system/health"
                ) as resp_sys:
                    sys_data = await resp_sys.json()

            local_d = sys_data.get("local", {})
            hw = sys_data.get("hardware", {})
            cloud = sys_data.get("cloud", {})

            models_loaded = local_d.get("models_loaded", [])
            model_lines = "\n".join(
                f"  • {m['name']} ({m.get('vram_mb', '?')} MB)" for m in models_loaded
            ) or "  • 無載入中"

            vram_used = local_d.get("total_vram_used_mb", 0)
            vram_total = hw.get("vram_total_mb", 16376)
            vram_pct = round(vram_used / vram_total * 100) if vram_total else 0
            vram_bar = "█" * (vram_pct // 10) + "░" * (10 - vram_pct // 10)

            text = (
                f"🖥️ <b>GPU 狀態監控</b>\n"
                f"━━━━━━━━━━━━━━━\n"
                f"🎮 <b>{hw.get('gpu', 'N/A')}</b>\n"
                f"💾 VRAM: {vram_used}/{vram_total} MB\n"
                f"     [{vram_bar}] {vram_pct}%\n\n"
                f"🧠 <b>載入中的模型:</b>\n{model_lines}\n\n"
                f"☁️ 雲端網關: {cloud.get('status', 'unknown')}\n"
                f"📍 Ollama: {local_d.get('state', 'unknown')}\n"
                f"🕒 {sys_data.get('timestamp', '')[:19]}"
            )
            await send_message(settings.telegram_bot_token, chat_id, text, parse_mode="HTML")

        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id,
                f"❌ 無法取得系統狀態: {e}")

        return

    return



async def handle_telegram(request: web.Request) -> web.Response:
    """Handle Telegram webhook updates (fallback for webhook mode)."""
    settings = request.app["settings"]
    store = request.app["watch_store"]

    if settings.telegram_webhook_secret_token:
        hdr = get_secret_header(request)
        if hdr != settings.telegram_webhook_secret_token:
            logger.warning("Invalid webhook secret token")
            return web.Response(status=401)

    try:
        update = await request.json()
    except Exception:
        return web.Response(status=400)

    import asyncio
    asyncio.create_task(process_update(update, settings, store))
    return web.Response(status=204)

async def telegram_polling_task(app: web.Application):
    """Background task to long-poll Telegram for updates."""
    import asyncio
    from aiohttp import ClientSession, ClientTimeout
    
    settings = app["settings"]
    store = app["watch_store"]
    token = settings.telegram_bot_token
    
    if not token:
        logger.error("No telegram_bot_token configured. Polling disabled.")
        return

    logger.info("Starting Telegram long polling task...")
    
    async with ClientSession(timeout=ClientTimeout(total=60)) as session:
        try:
            async with session.post(f"https://api.telegram.org/bot{token}/deleteWebhook") as resp:
                if resp.status == 200:
                    logger.info("Webhook deleted successfully.")
                else:
                    logger.warning(f"Failed to delete webhook: {resp.status}")
        except Exception as e:
            logger.error(f"Error deleting webhook: {e}")

        offset = 0
        while True:
            try:
                url = f"https://api.telegram.org/bot{token}/getUpdates"
                payload = {"offset": offset, "timeout": 30}
                async with session.post(url, json=payload) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        updates = data.get("result", [])
                        for update in updates:
                            offset = max(offset, update["update_id"] + 1)
                            asyncio.create_task(process_update(update, settings, store))
                    elif resp.status == 409:
                        logger.error("Polling conflict 409: Webhook still active?")
                        await asyncio.sleep(5)
                    else:
                        logger.error(f"Polling failed with {resp.status}")
                        await asyncio.sleep(5)
            except asyncio.CancelledError:
                logger.info("Telegram polling task cancelled.")
                break
            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(5)

async def start_telegram_polling(app: web.Application):
    import asyncio
    app["telegram_polling"] = asyncio.create_task(telegram_polling_task(app))

async def cleanup_telegram_polling(app: web.Application):
    task = app.get("telegram_polling")
    if task:
        task.cancel()
        import asyncio
        import contextlib
        with contextlib.suppress(asyncio.CancelledError):
            await task

async def handle_health(request: web.Request) -> web.Response:
    """Health check endpoint."""
    return web.json_response({"ok": True})


def create_app() -> web.Application:
    """Create the aiohttp application."""
    settings = Settings()
    
    app = web.Application()
    app["settings"] = settings
    app["watch_store"] = WatchStore(settings.redis_host, settings.redis_port)

    app.router.add_post("/telegram", handle_telegram)
    app.router.add_get("/healthz", handle_health)
    
    app.on_startup.append(start_telegram_polling)
    app.on_cleanup.append(cleanup_telegram_polling)
    
    return app



# ── /admin — 總部大廳行政管家與客服 ──────────────────────────────

async def handle_admin(args: list, chat_id: str, settings: Settings) -> None:
    """Nova — 總部大廳行政管家與客服"""
    user_msg = " ".join(args).strip()
    await send_message(settings.telegram_bot_token, chat_id, "🏢 <b>Nova (行政客服)</b>\n收到您的行政事務/客服請求，正在為您處理...", parse_mode="HTML")
    import asyncio
    asyncio.create_task(
        call_agent_and_reply(
            settings.openclaw_gateway_url,
            settings.telegram_bot_token,
            chat_id,
            "/agents/nova/chat",
            f"[行政與客服事項] {user_msg}",
            "🏢 <b>Nova (行政客服) 回覆：</b>"
        )
    )

# ── /loan — 融鑫財務顧問 ─────────────────────────────────────────

async def handle_loan(args: list, chat_id: int, settings) -> None:
    """Flux 🐠 資本結構與融資顧問指令群"""
    from aiohttp import ClientSession, ClientTimeout

    cmd_sub = " ".join(args).strip()
    sub = args[0].lower() if args else ""
    sub_args = args[1:]
    FINANCE_URL = settings.openclaw_gateway_url

    # ── /loan (無參數) — 負債儀表板 ─────────────────────────
    if not sub or sub == "dashboard":
        await send_message(settings.telegram_bot_token, chat_id, "🐟 融鑫：載入負債儀表板中...")
        try:
            timeout = ClientTimeout(total=15)
            async with ClientSession(timeout=timeout) as session:
                async with session.get(
                    f"{FINANCE_URL}/agents/finance/report/cashflow",
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_cf:
                    cf = await resp_cf.json()
                async with session.get(
                    f"{FINANCE_URL}/agents/finance/calc/summary",
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_s:
                    s = await resp_s.json()

            alert = cf.get("overall_alert", "OK")
            alert_icon = {"CRITICAL": "🚨", "WARNING": "⚠️", "OK": "✅"}.get(alert, "📊")
            dsr = cf.get("dsr_analysis", {})
            total_out = s.get("grand_total_outstanding", 0)
            total_month = s.get("grand_total_monthly", 0)

            msg = (
                f"🐟 <b>融鑫負債儀表板</b>\n"
                f"━━━━━━━━━━━━━━━\n"
                f"{alert_icon} 狀態: {alert}\n\n"
                f"💰 <b>負債概況</b>\n"
                f"  未還本金: NT$ {total_out:,.0f}\n"
                f"  月繳合計: NT$ {total_month:,.0f}\n\n"
                f"📊 <b>DSR 債務比率（個人）</b>\n"
                f"  {dsr.get('dsr_label', 'N/A')}\n"
                f"  月繳/月薪 = NT${dsr.get('personal_loan_monthly', 0):,.0f} / NT${dsr.get('personal_monthly_income', 0):,.0f}\n\n"
            )
            by_entity = s.get("by_entity", [])
            for e in by_entity:
                if e.get("active_count", 0) > 0:
                    msg += f"  {e.get('entity_label', '')} | {e['active_count']}筆 | 月繳NT${e.get('total_monthly_payment', 0):,.0f}\n"

            alerts_list = cf.get("alerts", [])
            if alerts_list:
                msg += "\n⚠️ <b>警示</b>\n"
                for a in alerts_list[:3]:
                    icon = "🚨" if a["level"] == "CRITICAL" else "⚠️"
                    msg += f"  {icon} {a['message']}\n"

            msg += (
                f"\n━━━━━━━━━━━━━━━\n"
                f"💡 /loan calc mortgage | /loan analyze | /loan help\n"
                f"🔒 <i>PRIVATE | 融鑫已就位</i>"
            )
            await send_message(settings.telegram_bot_token, chat_id, msg, parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 儀表板載入失敗: {e}")
        return

    # ── /loan help ──────────────────────────────────────────
    if sub == "help":
        await send_message(
            settings.telegram_bot_token, chat_id,
            "🐟 <b>融鑫 — 貸款財務顧問指令說明</b>\n"
            "━━━━━━━━━━━━━━━\n\n"
            "<b>📊 儀表板</b>\n"
            "  /loan                    → 負債儀表板\n"
            "  /loan analyze            → AI資金壓力分析（串接帳本）\n\n"
            "<b>🏦 快速試算</b>\n"
            "  /loan calc mortgage &lt;房價&gt; &lt;貸款額&gt; &lt;年利率&gt; [期數月] [寬限月] [月收入]\n"
            "  /loan calc car &lt;車價&gt; &lt;頭期款&gt; &lt;年利率&gt; [期數月]\n"
            "  /loan calc loan &lt;本金&gt; &lt;年利率&gt; &lt;期數月&gt; [還款方式]\n"
            "  /loan calc compare       → 多方案比較（見說明）\n"
            "  /loan calc summary       → 三實體貸款彙整\n\n"
            "<b>🗂️ 融資規劃（AI）</b>\n"
            "  /loan plan company       → 工程公司融資方案\n"
            "  /loan plan personal      → 個人貸款優化\n"
            "  /loan plan family        → 家庭負債規劃\n"
            "  /loan plan consolidation → 負債整合分析\n\n"
            "<b>📋 貸款管理</b>\n"
            "  /loan list               → 列出所有貸款\n"
            "  /loan add &lt;類型&gt; &lt;銀行&gt; &lt;本金&gt; &lt;年利率&gt; &lt;期數&gt; &lt;起日&gt; [entity]\n"
            "  /loan del &lt;ID&gt;\n\n"
            "<b>📈 報告</b>\n"
            "  /loan report cashflow    → 資金壓力報告（含DSR）\n"
            "  /loan report debt        → 負債總覽（含利率排序）\n\n"
            "還款方式: equal_payment（等額本息）| equal_principal（等額本金）| interest_only（只繳息）\n"
            "entity: company | personal | family\n\n"
            "🔒 <i>所有貸款資訊強制本地推理 | PRIVATE</i>",
            parse_mode="HTML"
        )
        return

    # ── /loan analyze ────────────────────────────────────────
    if sub == "analyze":
        await send_message(settings.telegram_bot_token, chat_id, "🐟 融鑫深度分析中，整合帳本數據... (約30秒)")
        try:
            timeout = ClientTimeout(total=90)
            async with ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{FINANCE_URL}/agents/finance/analyze",
                    json={},
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_a:
                    data_a = await resp_a.json()
            analysis = format_for_telegram(data_a.get("analysis", ""))
            latency = data_a.get("latency_ms", 0)
            ds = data_a.get("data_summary", {})
            total_out = ds.get("total_outstanding", 0)
            total_month = ds.get("total_monthly", 0)

            header = (
                f"🐟 <b>融鑫資金壓力分析</b>\n"
                f"━━━━━━━━━━━━━━━\n"
                f"未還本金: NT${total_out:,.0f} | 月繳: NT${total_month:,.0f}\n"
                f"個人DSR: {ds.get('personal', {}).get('dsr_pct', 'N/A')}%\n"
                f"━━━━━━━━━━━━━━━\n\n"
            )
            await send_message(settings.telegram_bot_token, chat_id,
                header + analysis[:3000] + f"\n\n<i>⏱ {latency:.0f}ms | 🔒 PRIVATE</i>",
                parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 分析失敗: {e}")
        return

    # ── /loan calc <type> ────────────────────────────────────
    if sub == "calc":
        calc_type = sub_args[0].lower() if sub_args else ""
        calc_args = sub_args[1:]

        if calc_type == "mortgage":
            # /loan calc mortgage <房價> <貸款額> <年利率> [期數月=360] [寬限月=0] [月收入=0]
            if len(calc_args) < 3:
                await send_message(settings.telegram_bot_token, chat_id,
                    "🏠 <b>房貸試算</b>\n\n"
                    "格式: /loan calc mortgage &lt;房價&gt; &lt;貸款額&gt; &lt;年利率&gt; [期數月] [寬限月] [月收入]\n\n"
                    "範例:\n"
                    "  /loan calc mortgage 15000000 10000000 2.17\n"
                    "  /loan calc mortgage 15000000 10000000 2.17 360 24 80000\n\n"
                    "主要銀行參考利率（2024年底）:\n"
                    "  • 土地銀行 2.15% | 台灣銀行 2.17%\n"
                    "  • 合作金庫 2.18% | 郵政儲金 2.16%\n"
                    "  • 國泰世華 2.25% | 玉山銀行 2.22%",
                    parse_mode="HTML")
                return
            try:
                pv = float(calc_args[0].replace(",", ""))
                la = float(calc_args[1].replace(",", ""))
                ar = float(calc_args[2])
                lm = int(calc_args[3]) if len(calc_args) > 3 else 360
                gp = int(calc_args[4]) if len(calc_args) > 4 else 0
                mi = float(calc_args[5].replace(",", "")) if len(calc_args) > 5 else 0
            except ValueError:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 數值格式錯誤")
                return
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{FINANCE_URL}/agents/finance/calc/mortgage",
                        json={"property_value": pv, "loan_amount": la, "annual_rate": ar,
                              "loan_months": lm, "monthly_income": mi, "grace_period_months": gp},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_m:
                        d = await resp_m.json()

                dsr_ok = d.get("is_dsr_ok", True)
                ltv = d.get("ltv_pct", 0)
                max_ltv = d.get("max_ltv_pct", 80)

                msg = (
                    f"🏠 <b>房貸試算</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"房價: NT${pv:,.0f} | 貸款: NT${la:,.0f}\n"
                    f"貸款成數: {ltv}%（上限{max_ltv}% {'✅' if ltv <= max_ltv else '⚠️'}）\n\n"
                    f"年利率: {ar}% | 期數: {lm}個月\n"
                )
                if gp > 0:
                    msg += f"寬限期 {gp}月，月繳利息: NT${d.get('grace_period_monthly', 0):,.0f}\n"
                msg += (
                    f"月繳（本息）: NT${d.get('monthly_payment_first', 0):,.0f}\n\n"
                    f"📊 <b>還款總覽</b>\n"
                    f"  總還款: NT${d.get('total_payment', 0):,.0f}\n"
                    f"  總利息: NT${d.get('total_interest', 0):,.0f} ({d.get('interest_ratio_pct', 0):.1f}%)\n\n"
                )
                if mi > 0:
                    msg += f"DSR: {d.get('dsr_pct', 0):.1f}% {'✅ 通過' if dsr_ok else '❌ 超標（建議月收入NT$' + str(d.get('monthly_income_required', 0)) + '）'}\n\n"

                msg += "🏦 <b>最低利率前3名</b>\n"
                for b in d.get("bank_suggestions", [])[:3]:
                    msg += f"  • {b['bank']} {b['rate']}%  {b['label']}\n"

                for note in d.get("notes", [])[:2]:
                    msg += f"\n{note}"

                await send_message(settings.telegram_bot_token, chat_id, msg, parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 試算失敗: {e}")
            return

        elif calc_type == "car":
            if len(calc_args) < 3:
                await send_message(settings.telegram_bot_token, chat_id,
                    "🚗 <b>車貸試算</b>\n\n"
                    "格式: /loan calc car &lt;車價&gt; &lt;頭期款&gt; &lt;年利率&gt; [期數月=60]\n"
                    "範例: /loan calc car 1200000 240000 3.5 60",
                    parse_mode="HTML")
                return
            try:
                vp = float(calc_args[0].replace(",", ""))
                dp = float(calc_args[1].replace(",", ""))
                ar = float(calc_args[2])
                lm = int(calc_args[3]) if len(calc_args) > 3 else 60
            except ValueError:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 數值格式錯誤")
                return
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{FINANCE_URL}/agents/finance/calc/car",
                        json={"vehicle_price": vp, "down_payment": dp, "annual_rate": ar, "loan_months": lm},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_c:
                        d = await resp_c.json()
                await send_message(settings.telegram_bot_token, chat_id,
                    f"🚗 <b>車貸試算</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"車價: NT${vp:,.0f} | 頭期款: NT${dp:,.0f}（{d.get('down_payment_pct', 0):.1f}%）\n"
                    f"貸款金額: NT${d.get('loan_amount', 0):,.0f}\n"
                    f"年利率: {ar}% | 期數: {lm}個月\n\n"
                    f"月繳: NT${d.get('monthly_payment_first', 0):,.0f}\n"
                    f"總還款: NT${d.get('total_payment', 0):,.0f}\n"
                    f"總利息: NT${d.get('total_interest', 0):,.0f}\n\n"
                    + "\n".join(d.get("notes", [])[:2]),
                    parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 試算失敗: {e}")
            return

        elif calc_type == "loan":
            if len(calc_args) < 3:
                await send_message(settings.telegram_bot_token, chat_id,
                    "💵 <b>通用貸款試算</b>\n\n"
                    "格式: /loan calc loan &lt;本金&gt; &lt;年利率&gt; &lt;期數月&gt; [還款方式]\n"
                    "還款方式: equal_payment（等額本息）| equal_principal（等額本金）| interest_only（只繳息）\n\n"
                    "範例: /loan calc loan 5000000 3.5 36 equal_payment",
                    parse_mode="HTML")
                return
            try:
                pr = float(calc_args[0].replace(",", ""))
                ar = float(calc_args[1])
                lm = int(calc_args[2])
                rm = calc_args[3] if len(calc_args) > 3 else "equal_payment"
            except ValueError:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 數值格式錯誤")
                return

            rm_zh = {"equal_payment": "等額本息", "equal_principal": "等額本金", "interest_only": "只繳息"}.get(rm, rm)
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{FINANCE_URL}/agents/finance/calc/loan",
                        json={"principal": pr, "annual_rate": ar, "loan_months": lm, "repayment_method": rm},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_l:
                        d = await resp_l.json()

                lines_l = [
                    f"💵 <b>貸款試算（{rm_zh}）</b>",
                    f"━━━━━━━━━━━━━━━",
                    f"本金: NT${pr:,.0f} | 年利率: {ar}% | 期數: {lm}個月",
                    f"",
                    f"月繳（首期）: NT${d.get('monthly_payment_first', 0):,.0f}",
                ]
                if d.get("monthly_payment_last"):
                    lines_l.append(f"月繳（末期）: NT${d.get('monthly_payment_last', 0):,.0f}")
                lines_l += [
                    f"",
                    f"總還款: NT${d.get('total_payment', 0):,.0f}",
                    f"總利息: NT${d.get('total_interest', 0):,.0f} ({d.get('interest_ratio_pct', 0):.1f}%)",
                ]
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_l), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 試算失敗: {e}")
            return

        elif calc_type == "summary":
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{FINANCE_URL}/agents/finance/calc/summary",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_s:
                        d = await resp_s.json()
                grand_out = d.get("grand_total_outstanding", 0)
                grand_month = d.get("grand_total_monthly", 0)
                lines_s = ["💰 <b>三實體貸款彙整</b>", "━━━━━━━━━━━━━━━"]
                for e in d.get("by_entity", []):
                    if e.get("active_count", 0) > 0:
                        lines_s.append(
                            f"{e.get('entity_label', '')}: {e['active_count']}筆\n"
                            f"  未還: NT${e.get('total_outstanding', 0):,.0f} | 月繳: NT${e.get('total_monthly_payment', 0):,.0f}"
                        )
                lines_s += [
                    "━━━━━━━━━━━━━━━",
                    f"未還本金合計: NT${grand_out:,.0f}",
                    f"月繳合計: NT${grand_month:,.0f}",
                ]
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_s), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
            return

        else:
            await send_message(settings.telegram_bot_token, chat_id,
                "💡 試算類型: mortgage | car | loan | summary\n"
                "範例: /loan calc mortgage 15000000 10000000 2.17")
            return

    # ── /loan plan <entity> ───────────────────────────────────
    if sub == "plan":
        entity = sub_args[0].lower() if sub_args else ""
        if entity not in ("company", "personal", "family", "consolidation"):
            await send_message(settings.telegram_bot_token, chat_id,
                "📋 規劃類型: company | personal | family | consolidation\n"
                "  /loan plan consolidation → 負債整合分析（最實用）")
            return
        zh_map = {"company": "工程公司融資", "personal": "個人貸款", "family": "家庭負債", "consolidation": "負債整合"}
        await send_message(settings.telegram_bot_token, chat_id,
            f"🐟 融鑫規劃中：{zh_map.get(entity, entity)}方案... (約30-60秒)")
        try:
            timeout = ClientTimeout(total=120)
            async with ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{FINANCE_URL}/agents/finance/plan/{entity}",
                    json={},
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_pl:
                    d = await resp_pl.json()

            plan = format_for_telegram(d.get("plan", ""))
            latency = d.get("latency_ms", 0)

            # 負債整合額外資訊
            debt_extra = ""
            if entity == "consolidation" and d.get("debt_analysis"):
                da = d["debt_analysis"]
                debt_extra = (
                    f"整合後月繳: NT${da.get('consolidated_monthly', 0):,.0f}\n"
                    f"月繳{'節省' if da.get('monthly_saving', 0) > 0 else '增加'}: NT${abs(da.get('monthly_saving', 0)):,.0f}\n"
                    f"{da.get('recommendation', '')}\n\n"
                )

            await send_message(settings.telegram_bot_token, chat_id,
                f"🐟 <b>融鑫 — {zh_map.get(entity, entity)}規劃</b>\n"
                f"━━━━━━━━━━━━━━━\n"
                f"{debt_extra}"
                f"{plan[:3500]}\n\n"
                f"<i>⏱ {latency:.0f}ms | 🔒 PRIVATE</i>",
                parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 規劃失敗: {e}")
        return

    # ── /loan list — 查詢貸款 ──────────────────────────────────
    if sub == "list":
        try:
            timeout = ClientTimeout(total=10)
            async with ClientSession(timeout=timeout) as session:
                async with session.get(
                    f"{FINANCE_URL}/agents/finance/loan",
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_lo:
                    d = await resp_lo.json()
            loans = d.get("loans", [])
            s = d.get("summary", {})
            if not loans:
                await send_message(settings.telegram_bot_token, chat_id,
                    "📋 <b>貸款列表</b>\n\n⚠️ 尚未登錄任何貸款\n\n"
                    "💡 /loan add mortgage 土地銀行 10000000 2.17 360 2024-01-01 family",
                    parse_mode="HTML")
                return
            lines_lo = [f"📋 <b>貸款列表（{d.get('count', 0)}筆）</b>", "━━━━━━━━━━━━━━━"]
            for lo in loans[:8]:
                lines_lo.append(
                    f"{'✅' if lo['status']=='active' else '❌'} {lo.get('entity_label', '')} | {lo.get('category_zh', lo['category'])}\n"
                    f"   {lo['bank']} | 年利率{lo['annual_rate']}% | 餘額NT${lo['outstanding_balance']:,.0f}\n"
                    f"   月繳NT${lo['monthly_payment']:,.0f} | ID: <code>{lo['loan_id'][:12]}</code>"
                )
            lines_lo += [
                "━━━━━━━━━━━━━━━",
                f"月繳合計: NT${s.get('total_monthly_payment', 0):,.0f}",
                f"未還本金: NT${s.get('total_outstanding', 0):,.0f}",
            ]
            await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_lo), parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
        return

    # ── /loan add <category> <bank> <principal> <rate> <months> <start_date> [entity] ─
    if sub == "add":
        if len(sub_args) < 6:
            await send_message(settings.telegram_bot_token, chat_id,
                "📝 格式: /loan add &lt;類型&gt; &lt;銀行&gt; &lt;本金&gt; &lt;年利率&gt; &lt;期數月&gt; &lt;起日&gt; [entity]\n\n"
                "entity: company | personal（預設）| family\n\n"
                "範例:\n"
                "  /loan add mortgage 土地銀行 10000000 2.17 360 2024-01-01 family\n"
                "  /loan add car_loan 國泰世華 800000 3.5 60 2024-06-01 personal\n"
                "  /loan add construction_working_capital 第一銀行 5000000 4.5 36 2024-03-01 company",
                parse_mode="HTML")
            return
        try:
            cat = sub_args[0].lower()
            bank = sub_args[1]
            principal = float(sub_args[2].replace(",", ""))
            rate = float(sub_args[3])
            months = int(sub_args[4])
            start_date = sub_args[5]
            entity_arg = sub_args[6].lower() if len(sub_args) > 6 else "personal"
            if entity_arg not in ("company", "personal", "family"):
                entity_arg = "personal"
        except (ValueError, IndexError):
            await send_message(settings.telegram_bot_token, chat_id, "❌ 格式錯誤")
            return
        ent_icons_lo = {"company": "🏢", "personal": "👤", "family": "🏠"}
        try:
            timeout = ClientTimeout(total=10)
            async with ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{FINANCE_URL}/agents/finance/loan",
                    json={
                        "entity_type": entity_arg, "category": cat, "bank": bank,
                        "principal": principal, "annual_rate": rate,
                        "loan_months": months, "start_date": start_date,
                    },
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_la:
                    d = await resp_la.json()
            s = d.get("summary", {})
            await send_message(settings.telegram_bot_token, chat_id,
                f"✅ <b>貸款已登錄</b>\n"
                f"{ent_icons_lo.get(entity_arg, '')} {entity_arg} | {s.get('category_zh', cat)}\n"
                f"銀行: {bank} | 本金: NT${principal:,.0f}\n"
                f"年利率: {rate}% | 期數: {months}個月\n"
                f"月繳估算: NT${s.get('monthly_payment', 0):,.0f}\n"
                f"ID: <code>{d.get('loan_id', '')[:12]}</code>\n\n"
                f"{d.get('ledger_tip', '')}",
                parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 新增失敗: {e}")
        return

    # ── /loan del <ID> ────────────────────────────────────────
    if sub == "del":
        lid = sub_args[0] if sub_args else ""
        if not lid:
            await send_message(settings.telegram_bot_token, chat_id, "❌ 格式: /loan del <貸款ID>")
            return
        try:
            timeout = ClientTimeout(total=10)
            async with ClientSession(timeout=timeout) as session:
                async with session.delete(
                    f"{FINANCE_URL}/agents/finance/loan/{lid}",
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_ld:
                    if resp_ld.status == 404:
                        await send_message(settings.telegram_bot_token, chat_id, f"❌ 找不到貸款: {lid}")
                    else:
                        await send_message(settings.telegram_bot_token, chat_id,
                            f"✅ 貸款已刪除: <code>{lid}</code>", parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 刪除失敗: {e}")
        return

    # ── /loan report <type> ───────────────────────────────────
    if sub == "report":
        report_type = sub_args[0].lower() if sub_args else ""

        if report_type == "cashflow":
            await send_message(settings.telegram_bot_token, chat_id, "🐟 生成資金壓力報告...")
            try:
                timeout = ClientTimeout(total=15)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{FINANCE_URL}/agents/finance/report/cashflow",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_r:
                        d = await resp_r.json()
                alert = d.get("overall_alert", "OK")
                alert_icon = {"CRITICAL": "🚨", "WARNING": "⚠️", "OK": "✅"}.get(alert, "📊")
                dsr = d.get("dsr_analysis", {})
                co = d.get("company_analysis", {})
                lines_r = [
                    f"{alert_icon} <b>資金壓力報告</b>",
                    f"━━━━━━━━━━━━━━━",
                    f"個人 DSR: {dsr.get('dsr_label', 'N/A')}",
                    f"公司貸款/收入比: {co.get('loan_revenue_ratio_pct', 0):.1f}%",
                    f"\n⚠️ <b>警示</b>",
                ]
                for a in d.get("alerts", [])[:4]:
                    icon = "🚨" if a["level"] == "CRITICAL" else "⚠️" if a["level"] == "WARNING" else "ℹ️"
                    lines_r.append(f"{icon} {a['message']}")
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_r), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 報告失敗: {e}")
            return

        elif report_type == "debt":
            try:
                timeout = ClientTimeout(total=15)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{FINANCE_URL}/agents/finance/report/debt",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_rd:
                        d = await resp_rd.json()
                lines_d = [
                    f"💰 <b>負債總覽報告</b>",
                    f"━━━━━━━━━━━━━━━",
                    f"未還本金: NT${d.get('total_outstanding', 0):,.0f}",
                    f"月繳合計: NT${d.get('total_monthly_payment', 0):,.0f}",
                    f"加權平均利率: {d.get('weighted_avg_rate', 0):.2f}%",
                    f"\n🎯 {d.get('payoff_priority', '')}",
                    f"\n🔴 <b>利率最高前3</b>",
                ]
                for h in d.get("high_rate_loans", [])[:3]:
                    lines_d.append(f"  • {h['bank']} {h['category_zh']} {h['annual_rate']}%  {h['suggestion']}")
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_d), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 報告失敗: {e}")
            return

        else:
            await send_message(settings.telegram_bot_token, chat_id,
                "📈 報告類型: cashflow | debt\n/loan report cashflow  或  /loan report debt")
            return

    # ── 自由問答 ─────────────────────────────────────────────
    question = cmd_sub if cmd_sub else "你好，請問您能幫我規劃哪方面的貸款或融資？"
    await send_message(settings.telegram_bot_token, chat_id, "🐟 融鑫思考中...")
    try:
        timeout = ClientTimeout(total=90)
        async with ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{FINANCE_URL}/agents/finance/chat",
                json={"message": question},
                headers={"Authorization": "Bearer dev-local-bypass"},
            ) as resp_fc:
                d = await resp_fc.json()
        reply = d.get("reply") or d.get("answer") or "無回應"
        reply = format_for_telegram(reply)
        latency = d.get("latency_ms", 0)
        await send_message(settings.telegram_bot_token, chat_id,
            f"🐟 <b>融鑫 — 貸款諮詢</b>\n━━━━━━━━━━━━━━━\n\n{reply[:3500]}\n\n"
            f"<i>⏱ {latency:.0f}ms | 🔒 PRIVATE</i>",
            parse_mode="HTML")
    except Exception as e:
        await send_message(settings.telegram_bot_token, chat_id, f"❌ 諮詢失敗: {e}")


# ── /ins — 安盾保險顧問 ──────────────────────────────────────────

async def handle_ins(args: list, chat_id: int, settings) -> None:
    """安盾 (Guardian) 保險顧問指令群"""
    from aiohttp import ClientSession, ClientTimeout

    cmd_sub = " ".join(args).strip()
    sub = args[0].lower() if args else ""
    sub_args = args[1:]
    GUARDIAN_URL = settings.openclaw_gateway_url

    # ── /ins (無參數) — 保障儀表板 ────────────────────────────
    if not sub or sub == "dashboard":
        await send_message(settings.telegram_bot_token, chat_id, "🐢 Shield：載入保障儀表板中...")
        try:
            timeout = ClientTimeout(total=15)
            async with ClientSession(timeout=timeout) as session:
                async with session.get(
                    f"{GUARDIAN_URL}/agents/guardian/report/gap",
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_gap:
                    gap_data = await resp_gap.json()
                async with session.get(
                    f"{GUARDIAN_URL}/agents/guardian/calc/premium",
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_prem:
                    prem_data = await resp_prem.json()

            alert = gap_data.get("alert_level", "OK")
            alert_icon = {"CRITICAL": "🚨", "WARNING": "⚠️", "OK": "✅"}.get(alert, "📊")
            score = gap_data.get("overall_score", 0)
            gs = gap_data.get("gap_summary", {})
            mand = gap_data.get("mandatory_compliance", {})
            life_gap = gap_data.get("life_insurance_gap", {})
            grand_total = prem_data.get("grand_total", 0)

            action_lines = []
            for a in gap_data.get("action_items", [])[:4]:
                icon = "🚨" if a["priority"] == "CRITICAL" else "⚠️" if a["priority"] == "HIGH" else "💡"
                action_lines.append(f"{icon} [{a['deadline']}] {a['action']}")

            msg = (
                f"🐢 <b>Shield 保障儀表板</b>\n"
                f"━━━━━━━━━━━━━━━\n"
                f"{alert_icon} 保障評分: {score}% | 狀態: {alert}\n\n"
                f"📊 <b>保障缺口核查</b>\n"
                f"  🚨 嚴重缺口: {gs.get('critical_gaps', 0)} 項\n"
                f"  ⚠️ 高風險缺口: {gs.get('high_gaps', 0)} 項\n"
                f"  ✅ 已覆蓋: {gs.get('covered', 0)}/{gs.get('total_checked', 0)} 項\n\n"
                f"🔒 <b>強制保險</b>\n"
            )
            for m in mand.get("missing", []):
                msg += f"  🚨 未到位：{m}\n"
            for c_item in mand.get("compliant", [])[:3]:
                msg += f"  ✅ {c_item}\n"
            msg += (
                f"\n💰 <b>保費概況</b>\n"
                f"  年繳合計: NT$ {grand_total:,.0f}\n"
                f"  {life_gap.get('gap_label', '')}\n\n"
            )
            if action_lines:
                msg += f"🎯 <b>優先行動</b>\n" + "\n".join(action_lines) + "\n\n"
            msg += (
                f"━━━━━━━━━━━━━━━\n"
                f"💡 /ins analyze | /ins plan all | /ins policy\n"
                f"🔒 <i>PRIVATE | Shield 已就位</i>"
            )
            await send_message(settings.telegram_bot_token, chat_id, msg, parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 儀表板載入失敗: {e}")
        return

    # ── /ins help ────────────────────────────────────────────
    if sub == "help":
        await send_message(
            settings.telegram_bot_token, chat_id,
            "🐢 <b>Shield — 風險保障規劃師指令說明</b>\n"
            "━━━━━━━━━━━━━━━\n\n"
            "<b>📊 儀表板</b>\n"
            "  /ins                     → 保障儀表板\n"
            "  /ins analyze             → AI缺口分析（串接帳本）\n\n"
            "<b>🏗️ 快速計算</b>\n"
            "  /ins calc car &lt;合約值&gt; &lt;工期月&gt; &lt;工班人數&gt;\n"
            "  /ins calc life &lt;年薪&gt; [負債] [房貸] [子女數]\n"
            "  /ins calc workers &lt;月薪&gt; [人數]\n"
            "  /ins calc premium        → 年度保費彙整\n\n"
            "<b>🗂️ 保障規劃（AI）</b>\n"
            "  /ins plan company        → 工程公司\n"
            "  /ins plan personal       → 個人\n"
            "  /ins plan family         → 家庭\n"
            "  /ins plan all            → 統合規劃（最完整）\n\n"
            "<b>📋 保單管理</b>\n"
            "  /ins policy              → 列出保單\n"
            "  /ins policy add &lt;類型&gt; &lt;公司&gt; &lt;保額&gt; &lt;年繳&gt; &lt;起日&gt; [entity]\n"
            "  /ins policy del &lt;ID&gt;\n\n"
            "<b>📈 報告</b>\n"
            "  /ins report gap          → 缺口分析\n"
            "  /ins report premium      → 保費核對帳本\n\n"
            "<b>常用類型:</b> car_insurance, pli, workers_comp, performance_bond,\n"
            "equipment, life_term, medical, accident, disability,\n"
            "house_fire, earthquake, long_term_care\n\n"
            "🔒 <i>所有保單資訊強制本地推理 | PRIVATE</i>",
            parse_mode="HTML"
        )
        return

    # ── /ins analyze — AI三實體缺口分析 ─────────────────────
    if sub == "analyze":
        await send_message(settings.telegram_bot_token, chat_id, "🐢 安盾深度分析中，整合帳本數據... (約30秒)")
        try:
            timeout = ClientTimeout(total=90)
            async with ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{GUARDIAN_URL}/agents/guardian/analyze",
                    json={},
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_a:
                    data_a = await resp_a.json()
            analysis = format_for_telegram(data_a.get("analysis", ""))
            latency = data_a.get("latency_ms", 0)
            ds = data_a.get("data_summary", {})
            total_prem = ds.get("total_annual_premium", 0)
            header = (
                f"🐢 <b>安盾保障缺口分析 {data_a.get('year', '')}年</b>\n"
                f"━━━━━━━━━━━━━━━\n"
                f"📋 保單: {ds.get('active_policies', 0)}張 | 年繳: NT${total_prem:,.0f}\n"
                f"━━━━━━━━━━━━━━━\n\n"
            )
            full_text = header + analysis[:3000]
            full_text += f"\n\n<i>⏱ {latency:.0f}ms | 🔒 PRIVATE</i>"
            await send_message(settings.telegram_bot_token, chat_id, full_text, parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 缺口分析失敗: {e}")
        return

    # ── /ins calc <type> ─────────────────────────────────────
    if sub == "calc":
        calc_type = sub_args[0].lower() if sub_args else ""
        calc_args = sub_args[1:]

        if calc_type == "car":
            if len(calc_args) < 3:
                await send_message(
                    settings.telegram_bot_token, chat_id,
                    "🏗️ <b>工程保險費率試算</b>\n\n"
                    "格式: /ins calc car &lt;合約值&gt; &lt;工期月&gt; &lt;工班人數&gt;\n"
                    "範例: /ins calc car 8500000 18 12",
                    parse_mode="HTML"
                )
                return
            try:
                cv = float(calc_args[0].replace(",", ""))
                dm = int(calc_args[1])
                wk = int(calc_args[2])
                pn = " ".join(calc_args[3:]) or None
            except ValueError:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 數值格式錯誤")
                return
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{GUARDIAN_URL}/agents/guardian/calc/car",
                        json={"contract_value": cv, "duration_months": dm, "workers": wk, "project_name": pn},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_c:
                        d = await resp_c.json()
                await send_message(
                    settings.telegram_bot_token, chat_id,
                    f"🏗️ <b>工程保險費率估算</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"工程: {d.get('project_name', '（未命名）')} | 合約: NT${cv:,.0f}\n"
                    f"工期: {dm}個月 | 工班: {wk}人\n\n"
                    f"📦 工程綜合險 (CAR): NT${d.get('car_premium', 0):,.0f}（{d.get('car_rate_pct', 0):.2f}%）\n"
                    f"🛡️ 公共責任險 (PLI): NT${d.get('pli_premium', 0):,.0f}（保額NT${d.get('pli_sum_insured', 0):,.0f}）\n"
                    f"👷 職災保險: NT${d.get('workers_comp_annual', 0):,.0f}/年\n\n"
                    f"💰 <b>合計年繳估算: NT${d.get('total_annual_premium', 0):,.0f}</b>\n\n"
                    f"<i>{d.get('legal_basis', '')}</i>",
                    parse_mode="HTML"
                )
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 試算失敗: {e}")
            return

        elif calc_type == "life":
            if not calc_args:
                await send_message(
                    settings.telegram_bot_token, chat_id,
                    "💰 <b>壽險保額 DIME法則</b>\n\n"
                    "格式: /ins calc life &lt;年薪&gt; [負債] [房貸] [子女數]\n"
                    "範例: /ins calc life 1440000 500000 8000000 2",
                    parse_mode="HTML"
                )
                return
            try:
                sal = float(calc_args[0].replace(",", ""))
                dbt = float(calc_args[1].replace(",", "")) if len(calc_args) > 1 else 0
                mtg = float(calc_args[2].replace(",", "")) if len(calc_args) > 2 else 0
                cld = int(calc_args[3]) if len(calc_args) > 3 else 0
            except ValueError:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 數值格式錯誤")
                return
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{GUARDIAN_URL}/agents/guardian/calc/life",
                        json={"annual_salary": sal, "debts": dbt, "mortgage": mtg, "children": cld},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_l:
                        d = await resp_l.json()
                db = d.get("dime_breakdown", {})
                await send_message(
                    settings.telegram_bot_token, chat_id,
                    f"💰 <b>壽險保額 — DIME 法則</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"D 負債: NT${db.get('D', 0):,.0f}\n"
                    f"I 收入({d.get('income_replacement_years', 10)}年): NT${db.get('I', 0):,.0f}\n"
                    f"M 房貸: NT${db.get('M', 0):,.0f}\n"
                    f"E 教育({cld}人): NT${db.get('E', 0):,.0f}\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"最低保額: NT${d.get('minimum_coverage', 0):,.0f}\n"
                    f"✅ <b>建議保額: NT${d.get('recommended_coverage', 0):,.0f}</b>\n"
                    f"月繳估算: NT${d.get('monthly_premium_estimate', 0):,.0f}",
                    parse_mode="HTML"
                )
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 計算失敗: {e}")
            return

        elif calc_type == "workers":
            if not calc_args:
                await send_message(
                    settings.telegram_bot_token, chat_id,
                    "👷 <b>職災補償試算（§59）</b>\n\n"
                    "格式: /ins calc workers &lt;月薪&gt; [人數]\n"
                    "範例: /ins calc workers 45000 12",
                    parse_mode="HTML"
                )
                return
            try:
                ms = float(calc_args[0].replace(",", ""))
                wk = int(calc_args[1]) if len(calc_args) > 1 else 1
            except ValueError:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 數值格式錯誤")
                return
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{GUARDIAN_URL}/agents/guardian/calc/workers",
                        json={"monthly_salary": ms, "workers": wk},
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_w:
                        d = await resp_w.json()
                await send_message(
                    settings.telegram_bot_token, chat_id,
                    f"👷 <b>職災補償試算（§59）</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"月薪: NT${ms:,.0f} | 人數: {wk}人\n\n"
                    f"死亡/永久失能: NT${d.get('death_compensation', 0):,.0f}\n"
                    f"喪葬費: NT${d.get('funeral_allowance', 0):,.0f}\n"
                    f"失能日薪補償: NT${d.get('disability_daily', 0):,.0f}/日\n\n"
                    f"⚠️ {wk}人最大負擔: NT${d.get('worst_case_total', 0):,.0f}\n"
                    f"🛡️ 建議每人保額: NT${d.get('recommended_coverage_per_person', 0):,.0f}\n\n"
                    f"<i>{d.get('legal_basis', '')}</i>",
                    parse_mode="HTML"
                )
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 試算失敗: {e}")
            return

        elif calc_type == "premium":
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{GUARDIAN_URL}/agents/guardian/calc/premium",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_p:
                        d = await resp_p.json()
                grand = d.get("grand_total", 0)
                lines_prem = ["💰 <b>年度保費彙整</b>", "━━━━━━━━━━━━━━━"]
                for ent in d.get("by_entity", []):
                    if ent.get("active_count", 0) > 0:
                        lines_prem.append(f"{ent.get('entity_label', '')}: {ent['active_count']}張 | NT${ent['total_annual_premium']:,.0f}")
                lines_prem += ["━━━━━━━━━━━━━━━", f"合計: NT${grand:,.0f}/年 (月均NT${grand//12:,.0f})"]
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_prem), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
            return
        else:
            await send_message(settings.telegram_bot_token, chat_id,
                "💡 計算類型: car | life | workers | premium\n範例: /ins calc car 8500000 18 12")
            return

    # ── /ins plan <entity> ────────────────────────────────────
    if sub == "plan":
        entity = sub_args[0].lower() if sub_args else ""
        if entity not in ("company", "personal", "family", "all"):
            await send_message(settings.telegram_bot_token, chat_id,
                "📋 規劃類型: company | personal | family | all\n"
                "  /ins plan all → 三實體統合（最完整，約60秒）")
            return
        api_entity = "full" if entity == "all" else entity
        zh_map = {"company": "工程公司", "personal": "個人", "family": "家庭", "all": "三實體統合"}
        await send_message(settings.telegram_bot_token, chat_id,
            f"🐢 安盾規劃中：{zh_map.get(entity, entity)}保障方案... (約30-60秒)")
        try:
            timeout = ClientTimeout(total=120)
            async with ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{GUARDIAN_URL}/agents/guardian/plan/{api_entity}",
                    json={},
                    headers={"Authorization": "Bearer dev-local-bypass"},
                ) as resp_pl:
                    d = await resp_pl.json()
            plan = format_for_telegram(d.get("plan", ""))
            latency = d.get("latency_ms", 0)
            full_text = f"🐢 <b>安盾 — {zh_map.get(entity, entity)}保障規劃</b>\n━━━━━━━━━━━━━━━\n\n"
            full_text += plan[:3500]
            full_text += f"\n\n<i>⏱ {latency:.0f}ms | 🔒 PRIVATE</i>"
            await send_message(settings.telegram_bot_token, chat_id, full_text, parse_mode="HTML")
        except Exception as e:
            await send_message(settings.telegram_bot_token, chat_id, f"❌ 規劃失敗: {e}")
        return

    # ── /ins policy — 保單管理 ───────────────────────────────
    if sub == "policy":
        policy_action = sub_args[0].lower() if sub_args else "list"

        if not sub_args or policy_action == "list":
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{GUARDIAN_URL}/agents/guardian/policy",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_po:
                        d = await resp_po.json()
                policies = d.get("policies", [])
                s = d.get("summary", {})
                if not policies:
                    await send_message(settings.telegram_bot_token, chat_id,
                        "📋 <b>保單列表</b>\n\n⚠️ 尚未登錄任何保單\n\n"
                        "💡 /ins policy add workers_comp 新光產險 10000000 48000 2024-01-01 company",
                        parse_mode="HTML")
                    return
                lines_po = [f"📋 <b>保單列表（{d.get('count', 0)}張）</b>", "━━━━━━━━━━━━━━━"]
                for p in policies[:10]:
                    status_icon = "✅" if p["status"] == "active" else "❌"
                    lines_po.append(
                        f"{status_icon} {p.get('entity_label', '')} | {p.get('category_zh', p['category'])}\n"
                        f"   {p['insurer']} | 保額NT${p['sum_insured']:,.0f} | 年繳NT${p['annual_premium']:,.0f}\n"
                        f"   ID: <code>{p['policy_id'][:12]}</code>"
                    )
                lines_po += ["━━━━━━━━━━━━━━━", f"年繳合計: NT${s.get('total_annual_premium', 0):,.0f}"]
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_po), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 查詢失敗: {e}")
            return

        elif policy_action == "add":
            # /ins policy add <category> <insurer> <sum_insured> <annual_premium> <start_date> [entity]
            if len(sub_args) < 6:
                await send_message(settings.telegram_bot_token, chat_id,
                    "📝 格式: /ins policy add &lt;類型&gt; &lt;保險公司&gt; &lt;保額&gt; &lt;年繳&gt; &lt;起日&gt; [entity]\n"
                    "entity: company（預設）| personal | family\n\n"
                    "範例:\n"
                    "  /ins policy add workers_comp 新光產險 10000000 48000 2024-01-01 company\n"
                    "  /ins policy add life_term 國泰人壽 5000000 36000 2024-06-01 personal",
                    parse_mode="HTML")
                return
            try:
                cat = sub_args[1].lower()
                insurer = sub_args[2]
                si = float(sub_args[3].replace(",", ""))
                ap = float(sub_args[4].replace(",", ""))
                sd = sub_args[5]
                entity_arg = sub_args[6].lower() if len(sub_args) > 6 else "company"
                if entity_arg not in ("company", "personal", "family"):
                    entity_arg = "company"
            except (ValueError, IndexError):
                await send_message(settings.telegram_bot_token, chat_id, "❌ 格式錯誤，請參考 /ins policy add 說明")
                return
            ent_icons_po = {"company": "🏢", "personal": "👤", "family": "🏠"}
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{GUARDIAN_URL}/agents/guardian/policy",
                        json={
                            "entity_type": entity_arg, "category": cat, "insurer": insurer,
                            "insured_name": "主被保人",
                            "sum_insured": si, "annual_premium": ap, "start_date": sd,
                        },
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_pa:
                        d = await resp_pa.json()
                s = d.get("summary", {})
                await send_message(settings.telegram_bot_token, chat_id,
                    f"✅ <b>保單已登錄</b>\n"
                    f"{ent_icons_po.get(entity_arg, '')} {entity_arg} | {s.get('category_zh', cat)}\n"
                    f"保險公司: {insurer} | 保額: NT${si:,.0f} | 年繳: NT${ap:,.0f}\n"
                    f"ID: <code>{d.get('policy_id', '')[:12]}</code>\n\n"
                    f"{d.get('ledger_tip', '')}",
                    parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 新增失敗: {e}")
            return

        elif policy_action == "del":
            pid = sub_args[1] if len(sub_args) > 1 else ""
            if not pid:
                await send_message(settings.telegram_bot_token, chat_id, "❌ 格式: /ins policy del <保單ID>")
                return
            try:
                timeout = ClientTimeout(total=10)
                async with ClientSession(timeout=timeout) as session:
                    async with session.delete(
                        f"{GUARDIAN_URL}/agents/guardian/policy/{pid}",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_del:
                        if resp_del.status == 404:
                            await send_message(settings.telegram_bot_token, chat_id, f"❌ 找不到保單: {pid}")
                        else:
                            await send_message(settings.telegram_bot_token, chat_id,
                                f"✅ 保單已刪除: <code>{pid}</code>", parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 刪除失敗: {e}")
            return

    # ── /ins report <type> ────────────────────────────────────
    if sub == "report":
        report_type = sub_args[0].lower() if sub_args else ""
        if report_type == "gap":
            await send_message(settings.telegram_bot_token, chat_id, "🐢 生成缺口報告中...")
            try:
                timeout = ClientTimeout(total=15)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{GUARDIAN_URL}/agents/guardian/report/gap",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_g:
                        d = await resp_g.json()
                alert = d.get("alert_level", "OK")
                alert_icon = {"CRITICAL": "🚨", "WARNING": "⚠️", "OK": "✅"}.get(alert, "📊")
                gs = d.get("gap_summary", {})
                life_gap = d.get("life_insurance_gap", {})
                lines_gap = [
                    f"{alert_icon} <b>保障缺口報告</b>", "━━━━━━━━━━━━━━━",
                    f"評分: {d.get('overall_score', 0)}% | 嚴重: {gs.get('critical_gaps', 0)} | 高風險: {gs.get('high_gaps', 0)}",
                    f"覆蓋: {gs.get('covered', 0)}/{gs.get('total_checked', 0)}",
                    f"\n{life_gap.get('gap_label', '')}",
                    "\n🎯 <b>優先行動</b>",
                ]
                for a in d.get("action_items", [])[:5]:
                    pri_icon = "🚨" if a["priority"] == "CRITICAL" else "⚠️" if a["priority"] == "HIGH" else "💡"
                    lines_gap.append(f"{pri_icon} [{a['deadline']}] {a['action']}")
                await send_message(settings.telegram_bot_token, chat_id, "\n".join(lines_gap), parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 報告失敗: {e}")
            return

        elif report_type == "premium":
            try:
                timeout = ClientTimeout(total=15)
                async with ClientSession(timeout=timeout) as session:
                    async with session.get(
                        f"{GUARDIAN_URL}/agents/guardian/report/premium",
                        headers={"Authorization": "Bearer dev-local-bypass"},
                    ) as resp_pr:
                        d = await resp_pr.json()
                reg = d.get("registered_in_guardian", {})
                rec = d.get("reconciliation", {})
                led = d.get("ledger_life_insurance", {})
                await send_message(settings.telegram_bot_token, chat_id,
                    f"💰 <b>保費核對報告</b>\n━━━━━━━━━━━━━━━\n"
                    f"保單登錄年繳: NT${reg.get('total_annual_premium', 0):,.0f}（{reg.get('policies_count', 0)}張）\n"
                    f"帳本 life_insurance: NT${led.get('annual_expense', 0):,.0f}\n"
                    f"━━━━━━━━━━━━━━━\n{rec.get('label', '')}",
                    parse_mode="HTML")
            except Exception as e:
                await send_message(settings.telegram_bot_token, chat_id, f"❌ 報告失敗: {e}")
            return
        else:
            await send_message(settings.telegram_bot_token, chat_id,
                "📈 報告類型: gap | premium\n/ins report gap  或  /ins report premium")
            return

    # ── 自由問答 ─────────────────────────────────────────────
    question = cmd_sub if cmd_sub else "你好，請問您能幫我規劃哪方面的保障？"
    await send_message(settings.telegram_bot_token, chat_id, "🐢 安盾思考中...")
    try:
        timeout = ClientTimeout(total=90)
        async with ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{GUARDIAN_URL}/agents/guardian/chat",
                json={"message": question},
                headers={"Authorization": "Bearer dev-local-bypass"},
            ) as resp_chat:
                d = await resp_chat.json()
        reply = d.get("reply") or d.get("answer") or "無回應"
        reply = format_for_telegram(reply)
        latency = d.get("latency_ms", 0)
        await send_message(settings.telegram_bot_token, chat_id,
            f"🐢 <b>安盾 — 保險諮詢</b>\n━━━━━━━━━━━━━━━\n\n{reply[:3500]}\n\n"
            f"<i>⏱ {latency:.0f}ms | 🔒 PRIVATE</i>",
            parse_mode="HTML")
    except Exception as e:
        await send_message(settings.telegram_bot_token, chat_id, f"❌ 諮詢失敗: {e}")


if __name__ == "__main__":
    logger.info("Starting telegram-command-bot service")
    web.run_app(create_app(), host="0.0.0.0", port=8080)
