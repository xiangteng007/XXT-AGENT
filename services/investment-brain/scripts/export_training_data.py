#!/usr/bin/env python3
"""
Export training data from Redis to Alpaca JSON format.

Usage:
    python -m scripts.export_training_data --output data/train.json
    python -m scripts.export_training_data --output data/train.json --limit 500
    python -m scripts.export_training_data --output data/train.json --min-reward 0.5
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("export")


async def export(
    output_path: str,
    redis_url: str = "redis://localhost:6379",
    limit: int = 500,
    min_reward: float = 0.0,
) -> None:
    """Export training examples from Redis to Alpaca JSON file."""
    try:
        import redis.asyncio as aioredis
    except ImportError:
        logger.error("redis package not installed: pip install redis")
        sys.exit(1)

    r = aioredis.from_url(redis_url)

    try:
        await r.ping()
        logger.info(f"Connected to Redis: {redis_url}")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        sys.exit(1)

    # Fetch raw examples
    raw = await r.lrange("training:examples", 0, limit - 1)
    logger.info(f"Found {len(raw)} raw examples in Redis")

    if not raw:
        logger.warning("No training data found. Run some analyses first.")
        await r.close()
        return

    examples = []
    skipped = 0

    for item in raw:
        try:
            data = json.loads(item)

            # Filter by minimum reward
            reward = data.get("reward", 0)
            if reward < min_reward:
                skipped += 1
                continue

            # Extract Alpaca fields
            alpaca_entry = {
                "instruction": data.get("instruction", data.get("input", {}).get("query", "")),
                "input": json.dumps(data.get("input", {}).get("context", {}), ensure_ascii=False)
                    if isinstance(data.get("input"), dict) else str(data.get("input", "")),
                "output": data.get("output", ""),
            }

            # Validate non-empty
            if alpaca_entry["instruction"] and alpaca_entry["output"]:
                examples.append(alpaca_entry)
            else:
                skipped += 1

        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Skipping malformed example: {e}")
            skipped += 1

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(examples, f, ensure_ascii=False, indent=2)

    logger.info(f"Exported {len(examples)} examples to {output_path}")
    if skipped:
        logger.info(f"Skipped {skipped} examples (below reward threshold or malformed)")

    # Stats
    rewards = [json.loads(item).get("reward", 0) for item in raw if item]
    if rewards:
        logger.info(f"Reward stats: min={min(rewards):.2f}, max={max(rewards):.2f}, avg={sum(rewards)/len(rewards):.2f}")

    await r.close()


def main():
    parser = argparse.ArgumentParser(description="Export training data to Alpaca JSON")
    parser.add_argument("--output", "-o", default="data/train.json", help="Output JSON path")
    parser.add_argument("--redis-url", default=os.getenv("REDIS_URL", "redis://localhost:6379"), help="Redis URL")
    parser.add_argument("--limit", type=int, default=500, help="Max examples to export")
    parser.add_argument("--min-reward", type=float, default=0.0, help="Minimum reward threshold")

    args = parser.parse_args()
    asyncio.run(export(args.output, args.redis_url, args.limit, args.min_reward))


if __name__ == "__main__":
    main()
