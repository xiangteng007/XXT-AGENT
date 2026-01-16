"""
Gemini API client for generating trade plans.
"""
from __future__ import annotations
import aiohttp
import orjson
import logging

logger = logging.getLogger("trade-planner-worker.gemini")


class GeminiClient:
    """
    Minimal REST client for Google Generative Language API (generateContent).
    """
    
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def endpoint(self) -> str:
        """Build API endpoint URL."""
        return f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

    async def generate_json(self, system_text: str, user_text: str) -> dict:
        """
        Generate JSON response from Gemini.
        
        Args:
            system_text: System instructions (SKILL contract)
            user_text: User data to analyze
            
        Returns:
            Parsed JSON response
        """
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"{system_text}\n\n{user_text}"}]}
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json"
            }
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(self.endpoint(), json=payload, timeout=30) as resp:
                txt = await resp.text()
                if resp.status != 200:
                    logger.error(f"Gemini API error: {resp.status} {txt[:200]}")
                    raise RuntimeError(f"Gemini error: {resp.status}")

        data = orjson.loads(txt)

        # Parse response JSON text from candidates[0].content.parts[0].text
        cand = (data.get("candidates") or [None])[0]
        parts = ((cand or {}).get("content") or {}).get("parts") or []
        text = (parts[0].get("text") if parts else "") or "{}"
        
        return orjson.loads(text)
