# 🧠 XXT-AGENT 智能投資大腦：全系統擴充性與本地模型自我進化架構規範

> 最終更新: 2026-05-17 18:15 (UTC+8)  
> 版本號: v1.0.0-PROD-SPEC  
> 核心目標: 打造 100% 閉環、無需人工干預、以市場真實回報為導向的本地大語言模型自我學習與進化管線。

---

## 📖 1. 核心設計理念與架構全景

本規範旨在為 **XXT-AGENT** 平台提供一個具備高度擴充性、架構合理性，且能實現 **「自我進化與持續修正」** 的本地大腦運作體系。

當前系統已實現基於本地 Qwen2.5-7B 的微調（SFT）與 Ollama 部署，但傳統的靜態微調模式無法適應瞬息萬變的金融市場。為了使本地模型「會自我學習及進步」，我們設計了 **「市場回報監督學習與偏好對齊閉環（Market-Supervised Preference Alignment, MSPA）」**。

### 🌀 自我進化雙環系統架構 (Dual-Loop Architecture)

```
       【 快環：即時推理與決策 】
       ┌───────────────────────┐
       │   用戶 / Dashboard    │ ◀─────────────────────────┐
       └───────────────────────┘                           │
           │               ▲                               │
           ▼               │                               │
       ┌───────────────────────┐                           │ (4) 熱重載模型
       │ OpenClaw Gateway :3100│                           │    Hot-Promote
       └───────────────────────┘                           │
           │               ▲                               │
           ▼               │                               │
       ┌───────────────────────┐     ┌──────────────┐      │
       │ Investment Brain :8090│ ──→ │ Ollama :11434│ ─────┼──┐
       │ (LangGraph 6-Node)    │     │ (Active LLoRA)      │  │
       └───────────────────────┘     └──────────────┘      │  │
           │                                               │  │
           │ (1) 記錄分析預測與特徵                         │  │
           ▼                                               │  │
    ========================= 核心數據庫與狀態 =========================
           │                                               │  │
           ▼                                               │  │
       ┌───────────────────────┐                           │  │
       │   Redis/SQLite/PG     │ ◄─────────────────────────┼──┘
       │  (Prediction Store)   │                           │  (1) 記錄
       └───────────────────────┘                           │
           │                                               │
           │ (2) T+7 天後抓取真實市場行情並自動打標          │
           ▼                                               │
       ┌───────────────────────┐                           │
       │ Market Feedback Loop  │                           │
       │ (Auto-DPO Generator)  │                           │
       └───────────────────────┘                           │
           │                                               │
           │ (3) 生成 Chosen/Rejected 偏好數據對             │
           ▼                                               │
       ┌───────────────────────┐                           │
       │  Auto-Train Daemon    │ ── (VRAM 資源鎖協調) ─────┘
       │  (Vanilla DPO/SFT)    │
       └───────────────────────┘
       【 慢環：離線自我進化與持續學習 】
```

---

## 🛠️ 2. 全系統合理性與擴充性規劃

為了支撐自我進化管線，系統必須具備極佳的模組化與高容錯率。

### 2.1 微服務解耦與負載隔離
- **推理服務 (FastAPI + Ollama)**: 運行於 8090 & 11434 端口。推理路徑使用 CPU/GPU 混合模式，必須保留足夠的 VRAM 應對即時請求。
- **訓練服務 (Train Daemon)**: 離線運行。在 Windows RTX 顯示卡環境下，**訓練與推理不能同時全力運行**，否則會導致 CUDA 記憶體溢出 (OOM)。因此，擴充性設計中包含一個 **VRAM 資源協調器 (VRAM Lock System)**，當觸發訓練時：
  1. 暫時將 Ollama 模型卸載（unloads model: `Ollama keep_alive = 0`）以釋放全部 VRAM。
  2. 啟動 `finetune_dpo.py` 進行 LoRA 微調。
  3. 微調結束，合併權重並自動重新載入 Ollama，恢復即時服務。

### 2.2 異步數據總線 (Message Bus & Cache)
- 使用 **Redis Stream** 作為實時行情與預測事件的異步總線。
- 所有大腦節點（Director, Macro, Technical, Sentiment 等）的 I/O 與 Prompt 全部存檔至 SQLite / PostgreSQL 數據庫（長期存儲），便於追溯與離線重演。

### 2.3 知識與記憶擴充性 (Memory Augmentation)
- **短暫記憶 (Short-term)**: 基於 Redis，儲存當前會話的多輪對話上下文（Session Context）。
- **情境記憶 (Regime Memory)**: 使用 **ChromaDB 向量數據庫**。當模型遇到當前市場行情（如：高通膨、低波動）時，自動從向量庫檢索 **「歷史上類似市場Regime下表現最佳的決策方案與分析報告」**，作為 In-Context Learning 注入 Prompt，這比直接微調更能快速吸收市場經驗。

---

## 📈 3. 本地模型自我學習與進步機制 (Self-Learning Closed-Loop)

本地大腦自我學習的核心在於 **「不要人工打標，要市場評分（Market-Labeled Learning）」**。

### 3.1 自主打標邏輯：市場實回報監督 (Market-Supervised)
當模型對某個股票（例如 `2330.TW`）給出分析報告時，我們會將該時間點的預測方向（如 `BUY`）、目標價、止損點，以及分析時的技術特徵（RSI、MACD、Regime）寫入預測庫快照。

經過 $T+N$（例如 $N=7$天 或 $14$天）之後，系統自動運行打標服務：
- **Chosen (正面偏好對)**:
  - 預測方向為 `BUY`，且實際價格在 7 天內最大漲幅 $\ge +3.0\%$ 且未跌破止損。
  - 預測方向為 `SELL`，且實際價格在 7 天內最大漲幅 $\le -3.0\%$。
- **Rejected (負面偏好對)**:
  - 預測方向為 `BUY`，但 7 天內實際价格不漲反跌，或者直接跌破止損。
  - 決策內容出現結構性錯誤（例如預測目標價與實際偏離過大）。

這對 (Chosen, Rejected) 直接代表了 **「市場用真金白銀對大腦決策進行的反饋」**，構成了 DPO 訓練數據的天然來源。

### 3.2 偏好數據生成與對齊 (DPO)
- 累積 50+ 個市場打標的 preference 對之後，觸發離線 DPO 微調。
- 本地 DPO 訓練旨在削弱模型中那些「在牛市中盲目喊買，在熊市中盲目喊賣」的幻覺傾向，使大腦決策風格更貼近真實市場獲利規律。

---

## 💻 4. 關鍵程式碼級藍圖 (Code Blueprints)

### 4.1 市場反饋監聽器與自動打標器 (`src/training/market_feedback_loop.py`)

這個模組負責定期檢查過期的預測，並使用真實行情數據（通過 OpenClaw 網關或本地 Fugle 用戶端）進行打標，直接生成 Chosen/Rejected 偏好對。

```python
# c:\Users\xiang\XXT-AGENT\services\investment-brain\src\training\market_feedback_loop.py
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List
import redis.asyncio as aioredis

logger = logging.getLogger("investment-brain.training.feedback")

class MarketFeedbackLoop:
    """自動監聽歷史決策，抓取真實行情，生成 DPO (Chosen/Rejected) 偏好對"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379", check_delay_days: int = 7):
        self.redis_url = redis_url
        self.check_delay_days = check_delay_days
        self.redis_key_pending = "training:predictions:pending"
        self.redis_key_accepted = "training:preferences:accepted"
        self.redis_key_rejected = "training:preferences:rejected"

    async def record_prediction(self, session_id: str, symbol: str, prediction: Dict[str, Any], market_context: Dict[str, Any]):
        """快環寫入：當大腦給出一個決策時，記錄其快照"""
        conn = aioredis.from_url(self.redis_url, decode_responses=True)
        record = {
            "session_id": session_id,
            "symbol": symbol,
            "timestamp": datetime.utcnow().isoformat(),
            "prediction": prediction,       # 包含 action: BUY/SELL/HOLD, target_price, stop_loss
            "market_context": market_context, # 包含當時 close_price, rsi, macd 等
            "status": "pending"
        }
        await conn.lpush(self.redis_key_pending, json.dumps(record, ensure_ascii=False))
        await conn.close()
        logger.info(f"[Feedback] Recorded pending prediction for {symbol} / {session_id}")

    async def evaluate_pending_predictions(self, gateway_client: Any):
        """慢環打標：定期執行（例如每天天亮前），獲取真實市場表現進行自我修正"""
        conn = aioredis.from_url(self.redis_url, decode_responses=True)
        length = await conn.llen(self.redis_key_pending)
        if length == 0:
            await conn.close()
            return

        logger.info(f"[Feedback] Starting evaluation for {length} pending predictions...")
        records_raw = await conn.lrange(self.redis_key_pending, 0, -1)
        
        for record_str in records_raw:
            record = json.loads(record_str)
            timestamp = datetime.fromisoformat(record["timestamp"])
            
            # 只有當預測時間超過 N 天時，我們才具備充足的未來行情數據進行評估
            if datetime.utcnow() - timestamp < timedelta(days=self.check_delay_days):
                continue
            
            symbol = record["symbol"]
            start_price = record["market_context"].get("price", 0)
            if start_price == 0:
                continue
                
            # 1. 通過網關獲取從當時到目前的 K 線數據以進行精準盈虧分析
            try:
                candles = await gateway_client.get_candles(
                    symbol=symbol,
                    start=timestamp.strftime("%y-%m-%d"),
                    end=datetime.utcnow().strftime("%y-%m-%d")
                )
            except Exception as e:
                logger.error(f"Failed to fetch market data for evaluation of {symbol}: {e}")
                continue

            if not candles:
                continue

            # 2. 計算最大漲跌幅
            high_prices = [c["high"] for c in candles]
            low_prices = [c["low"] for c in candles]
            end_price = candles[-1]["close"]
            
            max_high = max(high_prices) if high_prices else start_price
            min_low = min(low_prices) if low_prices else start_price
            
            action = record["prediction"].get("investment_plan", {}).get("action", "HOLD").upper()
            target_price = record["prediction"].get("investment_plan", {}).get("target_price", start_price * 1.1)
            stop_loss = record["prediction"].get("investment_plan", {}).get("stop_loss", start_price * 0.95)

            # 3. 自我學習打分邏輯 (Reward Logic)
            is_success = False
            if action in ["BUY", "STRONG_BUY"]:
                # 如果觸及止損，則徹底失敗；如果成功觸碰目標價或總體上漲，則為成功
                if min_low <= stop_loss:
                    is_success = False
                elif max_high >= target_price or end_price > start_price * 1.03:
                    is_success = True
            elif action in ["SELL", "STRONG_SELL"]:
                if max_high >= stop_loss:
                    is_success = False
                elif min_low <= target_price or end_price < start_price * 0.97:
                    is_success = True
            else: # HOLD
                # 波動率極低或價格平穩即成功
                is_success = abs(end_price - start_price) / start_price < 0.03

            # 4. 構造 DPO 偏好對 (Prompt -> Chosen Response -> Rejected Response)
            prompt = f"分析 {symbol} 的投資機會並給出操作決策。"
            original_output = json.dumps(record["prediction"], ensure_ascii=False)
            
            # 如果成功，原輸出即為 Chosen；如果失敗，我們生成一個反向的修正決策作為 Chosen
            if is_success:
                chosen = original_output
                rejected = json.dumps(self._generate_opposite_plan(record["prediction"], "決策失誤，與市場行情背離"), ensure_ascii=False)
            else:
                # 若大腦給出買入卻大跌，此時買入應成為 Rejected，修正後的 HOLD/SELL 成為 Chosen
                chosen = json.dumps(self._generate_opposite_plan(record["prediction"], "價格下挫，觸及防禦性避險"), ensure_ascii=False)
                rejected = original_output

            dpo_entry = {
                "prompt": prompt,
                "chosen": chosen,
                "rejected": rejected,
                "symbol": symbol,
                "timestamp": datetime.utcnow().isoformat()
            }

            # 5. 分發至 DPO 偏好庫，等待達到閾值後自動觸微調
            if is_success:
                await conn.lpush(self.redis_key_accepted, json.dumps(dpo_entry, ensure_ascii=False))
            else:
                await conn.lpush(self.redis_key_rejected, json.dumps(dpo_entry, ensure_ascii=False))

            # 從待評估隊列中移除該條記錄
            await conn.lrem(self.redis_key_pending, 1, record_str)
            logger.info(f"[Feedback] Evaluated prediction {record['session_id']} for {symbol}. Success={is_success}")

        await conn.close()

    def _generate_opposite_plan(self, original_plan: Dict[str, Any], correction_reason: str) -> Dict[str, Any]:
        """修正決策生成器"""
        corrected = original_plan.copy()
        plan = corrected.get("investment_plan", {})
        action = plan.get("action", "HOLD").upper()
        
        # 反向決策
        if action in ["BUY", "STRONG_BUY"]:
            plan["action"] = "SELL"
            plan["rationale"] = f"【模型自我學習糾偏】: {correction_reason}。從原多頭轉為空頭防禦性操作。"
        elif action in ["SELL", "STRONG_SELL"]:
            plan["action"] = "BUY"
            plan["rationale"] = f"【模型自我學習糾偏】: {correction_reason}。原空頭判斷失誤，市場展現強勢多頭特徵。"
        else:
            plan["action"] = "HOLD"
            plan["rationale"] = f"【模型自我學習糾偏】: {correction_reason}。市場震盪走勢，維持觀望操作。"
            
        corrected["investment_plan"] = plan
        return corrected
