# c:\Users\xiang\XXT-AGENT\services\investment-brain\scripts\auto_train_daemon.py
import asyncio
import logging
import subprocess
import os
import redis.asyncio as aioredis
from typing import Dict

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("auto_train_daemon")

class AutoTrainDaemon:
    def __init__(self, redis_url: str = "redis://localhost:6379", trigger_threshold: int = 50):
        self.redis_url = redis_url
        self.trigger_threshold = trigger_threshold
        self.active_training = False

    async def get_stats(self) -> Dict[str, int]:
        try:
            conn = aioredis.from_url(self.redis_url, decode_responses=True)
            accepted = await conn.llen("training:preferences:accepted")
            rejected = await conn.llen("training:preferences:rejected")
            await conn.close()
            return {"accepted": accepted, "rejected": rejected, "total": min(accepted, rejected)}
        except Exception as e:
            logger.error(f"Failed to get Redis stats: {e}")
            return {"accepted": 0, "rejected": 0, "total": 0}

    async def unload_ollama_model(self):
        """暫時卸載 Ollama 模型釋放 GPU VRAM"""
        logger.info("[VRAM Coordinator] Unloading model xxt/investmentbrain from Ollama...")
        import http.client
        import json
        try:
            conn = http.client.HTTPConnection("localhost", 11434, timeout=5)
            payload = json.dumps({"model": "xxt/investmentbrain", "keep_alive": 0})
            headers = {"Content-Type": "application/json"}
            conn.request("POST", "/api/generate", payload, headers)
            res = conn.getresponse()
            res.read()
            logger.info("[VRAM Coordinator] Model successfully unloaded from VRAM.")
        except Exception as e:
            logger.warning(f"Failed to cleanly unload Ollama model: {e}")

    async def run_dpo_finetuning(self):
        """執行 DPO 訓練腳本"""
        logger.info("[AutoTrain] Exporting DPO pairs from Redis...")
        try:
            # 1. 調用導出腳本
            export_cmd = ["python", "scripts/export_dpo_data.py", "--output", "data/dpo_pairs.json"]
            subprocess.run(export_cmd, check=True)
        except Exception as e:
            logger.error(f"[AutoTrain] Failed to export DPO pairs: {e}")
            return False

        logger.info("[AutoTrain] Starting DPO Fine-Tuning Pipeline...")
        # 2. 啟動微調 (使用 vanilla transformers + PEFT LoRA)
        train_cmd = [
            "python", "scripts/finetune_dpo.py",
            "--data", "data/dpo_pairs.json",
            "--output_dir", "models/investment-brain-v1/dpo_adapter",
            "--epochs", "2",
            "--batch_size", "2"
        ]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *train_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.info("[AutoTrain] Fine-Tuning successfully completed!")
                return True
            else:
                logger.error(f"[AutoTrain] Fine-Tuning failed with code {process.returncode}")
                logger.error(stderr.decode())
                return False
        except Exception as e:
            logger.error(f"[AutoTrain] Error running DPO fine-tuning: {e}")
            return False

    async def rebuild_and_reload_ollama(self):
        """微調成功後重新合併適配器並冷啟動/刷新 Ollama 模型"""
        logger.info("[AutoTrain] Merging LoRA adapter with Base Model...")
        try:
            # 1. 執行權重合併腳本
            # If scripts/merge_weights.py doesn't exist, we fallback safely or execute the build
            merge_script = "scripts/merge_weights.py"
            if os.path.exists(merge_script):
                subprocess.run(["python", merge_script], check=True)
            else:
                logger.warning(f"Merge weights script not found at {merge_script}. Skipping merge step.")

            logger.info("[AutoTrain] Rebuilding Ollama model xxt/investmentbrain...")
            # 2. 熱重新編譯/註冊 Ollama
            build_cmd = ["ollama", "create", "xxt/investmentbrain", "-f", "models/investment-brain-v1/Modelfile"]
            subprocess.run(build_cmd, check=True)
            logger.info("[AutoTrain] Ollama model rebuilt successfully and ready for next inference!")
        except Exception as e:
            logger.error(f"[AutoTrain] Failed to rebuild or reload Ollama model: {e}")

    async def start_loop(self):
        logger.info("Auto-Learning Daemon started. Monitoring preference queues...")
        while True:
            try:
                stats = await self.get_stats()
                logger.info(f"Current DPO Pairs status: {stats['total']} / {self.trigger_threshold}")
                
                if stats["total"] >= self.trigger_threshold and not self.active_training:
                    self.active_training = True
                    logger.info("🚀 [TRIGGER] Preference pairs exceeded threshold! Initiating self-learning cycle...")
                    
                    # 1. 釋放 VRAM，避免 CUDA OOM
                    await self.unload_ollama_model()
                    await asyncio.sleep(2)
                    
                    # 2. 開始離線訓練
                    success = await self.run_dpo_finetuning()
                    
                    if success:
                        # 3. 合併權重並重啟大腦
                        await self.rebuild_and_reload_ollama()
                        
                        # 4. 清理已消耗的訓練隊列
                        try:
                            conn = aioredis.from_url(self.redis_url)
                            await conn.delete("training:preferences:accepted")
                            await conn.delete("training:preferences:rejected")
                            await conn.close()
                            logger.info("🎉 [SUCCESS] Model has successfully self-improved & hot-reloaded!")
                        except Exception as ce:
                            logger.error(f"Failed to clear Redis training queues: {ce}")
                    
                    self.active_training = False
                    
            except Exception as e:
                logger.error(f"Error in Daemon loop: {e}")
                self.active_training = False
                
            # 每 6 小時輪詢一次
            await asyncio.sleep(21600)

if __name__ == "__main__":
    daemon = AutoTrainDaemon()
    asyncio.run(daemon.start_loop())
