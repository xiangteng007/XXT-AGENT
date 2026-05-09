"""
XXT-AGENT 推理品質 Benchmark
用途：評估 Ollama 模型對標準問題的回答品質

使用方式：
    python scripts/benchmark_inference.py

需求：
    pip install aiohttp
"""
import asyncio
import json
import time
import aiohttp

OLLAMA_URL = "http://localhost:11434"

# 10 個標準測試問題（中文 + 英文混合）
BENCHMARK_QUESTIONS = [
    {
        "id": "Q01",
        "category": "intent_classification",
        "prompt": "幫我查一下台積電的股價",
        "expected_intent": "market_query",
        "expected_keywords": ["台積電", "股價"],
    },
    {
        "id": "Q02",
        "category": "intent_classification",
        "prompt": "今天天氣如何",
        "expected_intent": "general_chat",
        "expected_keywords": ["天氣"],
    },
    {
        "id": "Q03",
        "category": "analysis",
        "prompt": "分析 NVIDIA 近期的財報表現，給出投資建議",
        "expected_intent": "analysis",
        "expected_keywords": ["NVIDIA", "財報", "建議"],
    },
    {
        "id": "Q04",
        "category": "legal",
        "prompt": "營造業的勞動契約需要包含哪些條款？",
        "expected_intent": "legal_query",
        "expected_keywords": ["勞動契約", "條款"],
    },
    {
        "id": "Q05",
        "category": "system",
        "prompt": "/system",
        "expected_intent": "command",
        "expected_keywords": ["系統", "健康"],
    },
    {
        "id": "Q06",
        "category": "insurance",
        "prompt": "我的汽車險保單什麼時候到期？",
        "expected_intent": "insurance_query",
        "expected_keywords": ["保單", "到期"],
    },
    {
        "id": "Q07",
        "category": "math",
        "prompt": "計算 100 坪的室內裝修費用，每坪 8 萬元",
        "expected_intent": "calculation",
        "expected_keywords": ["800 萬", "8,000,000"],
    },
    {
        "id": "Q08",
        "category": "translation",
        "prompt": "Translate '建築工程施工規範' to English",
        "expected_intent": "translation",
        "expected_keywords": ["construction", "specification"],
    },
    {
        "id": "Q09",
        "category": "regulation",
        "prompt": "台灣無人機考照需要什麼資格？",
        "expected_intent": "regulation_query",
        "expected_keywords": ["無人機", "資格", "考照"],
    },
    {
        "id": "Q10",
        "category": "summary",
        "prompt": "請用一句話總結：人工智慧正在改變全球金融市場的運作方式，從高頻交易到風險管理，AI系統已經成為不可或缺的工具。",
        "expected_intent": "summarization",
        "expected_keywords": ["AI", "金融"],
    },
]


async def run_inference(session: aiohttp.ClientSession, model: str, prompt: str) -> dict:
    """Run a single inference and return timing + response."""
    start = time.monotonic()
    try:
        async with session.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 256},
            },
            timeout=aiohttp.ClientTimeout(total=60),
        ) as resp:
            elapsed = time.monotonic() - start
            if resp.status == 200:
                data = await resp.json()
                return {
                    "ok": True,
                    "response": data.get("response", ""),
                    "elapsed_s": round(elapsed, 2),
                    "eval_count": data.get("eval_count", 0),
                    "tokens_per_sec": round(
                        data.get("eval_count", 0) / max(elapsed, 0.01), 1
                    ),
                }
            return {"ok": False, "error": f"HTTP {resp.status}", "elapsed_s": round(elapsed, 2)}
    except Exception as e:
        return {"ok": False, "error": str(e), "elapsed_s": round(time.monotonic() - start, 2)}


def score_response(question: dict, response: str) -> dict:
    """Score the response against expected keywords."""
    response_lower = response.lower()
    hits = sum(1 for kw in question["expected_keywords"] if kw.lower() in response_lower)
    total = len(question["expected_keywords"])
    return {
        "keyword_hits": hits,
        "keyword_total": total,
        "keyword_score": round(hits / max(total, 1), 2),
        "response_length": len(response),
    }


async def benchmark_model(model: str):
    """Run full benchmark for a single model."""
    print(f"\n{'='*60}")
    print(f"  Benchmarking: {model}")
    print(f"{'='*60}")

    async with aiohttp.ClientSession() as session:
        results = []
        for q in BENCHMARK_QUESTIONS:
            print(f"  [{q['id']}] {q['prompt'][:40]}...", end=" ", flush=True)
            result = await run_inference(session, model, q["prompt"])

            if result["ok"]:
                scores = score_response(q, result["response"])
                result.update(scores)
                emoji = "✅" if scores["keyword_score"] >= 0.5 else "⚠️"
                print(f"{emoji} {result['elapsed_s']}s | {result['tokens_per_sec']} tok/s | kw: {scores['keyword_hits']}/{scores['keyword_total']}")
            else:
                print(f"❌ {result['error']}")

            result["question_id"] = q["id"]
            result["category"] = q["category"]
            results.append(result)

        # Summary
        ok_results = [r for r in results if r.get("ok")]
        if ok_results:
            avg_time = round(sum(r["elapsed_s"] for r in ok_results) / len(ok_results), 2)
            avg_tps = round(sum(r["tokens_per_sec"] for r in ok_results) / len(ok_results), 1)
            avg_kw = round(sum(r.get("keyword_score", 0) for r in ok_results) / len(ok_results), 2)
            print(f"\n  📊 Summary: {len(ok_results)}/{len(results)} OK | Avg {avg_time}s | {avg_tps} tok/s | KW Score: {avg_kw}")
        else:
            print(f"\n  ❌ All {len(results)} tests failed")

        return {"model": model, "results": results}


async def main():
    print("XXT-AGENT 推理品質 Benchmark")
    print(f"Ollama URL: {OLLAMA_URL}")
    print(f"Questions: {len(BENCHMARK_QUESTIONS)}")

    # Check Ollama is up
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{OLLAMA_URL}/api/tags", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    models = [m["name"] for m in data.get("models", [])]
                    print(f"Available models: {', '.join(models)}")
                else:
                    print("❌ Ollama returned non-200")
                    return
    except Exception as e:
        print(f"❌ Ollama unreachable: {e}")
        return

    # Benchmark lightweight model first
    test_models = ["nemotron-mini:4b", "qwen3:14b"]
    all_results = []
    for model in test_models:
        if model.split(":")[0] in " ".join(models):
            result = await benchmark_model(model)
            all_results.append(result)

    # Save results
    output_file = "benchmark_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\n📄 Results saved to {output_file}")


if __name__ == "__main__":
    asyncio.run(main())
