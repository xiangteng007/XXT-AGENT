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
        try:
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
        except Exception as e:
            logger.error(f"[Feedback] Failed to record prediction: {e}")

    async def evaluate_pending_predictions(self, gateway_client: Any):
        """慢環打標：定期執行（例如每天天亮前），獲取真實市場表現進行自我修正"""
        try:
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
                        start=timestamp.strftime("%Y-%m-%d"),
                        end=datetime.utcnow().strftime("%Y-%m-%d")
                    )
                except Exception as e:
                    logger.error(f"Failed to fetch market data for evaluation of {symbol}: {e}")
                    continue

                if not candles:
                    continue

                # 2. 計算最大漲跌幅
                high_prices = [c.get("high", start_price) for c in candles]
                low_prices = [c.get("low", start_price) for c in candles]
                end_price = candles[-1].get("close", start_price)
                
                max_high = max(high_prices) if high_prices else start_price
                min_low = min(low_prices) if low_prices else start_price
                
                plan = record["prediction"].get("investment_plan", {})
                action = plan.get("action", "HOLD").upper()
                target_price = plan.get("target_price", start_price * 1.1)
                stop_loss = plan.get("stop_loss", start_price * 0.95)

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
        except Exception as e:
            logger.error(f"[Feedback] Error in evaluate_pending_predictions: {e}")

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
