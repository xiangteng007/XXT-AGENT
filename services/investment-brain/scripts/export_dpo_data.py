#!/usr/bin/env python3
"""
Export DPO preference pairs from Redis.

Usage:
    python -m scripts.export_dpo_data --output data/dpo_pairs.json
    python -m scripts.export_dpo_data --output data/dpo_pairs.json --limit 200
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("export-dpo")


async def export(
    output_path: str,
    redis_url: str = "redis://localhost:6379",
    limit: int = 200,
) -> None:
    """Export DPO pairs via preference_collector."""
    # Add src to path for imports
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    try:
        from src.training.preference_collector import PreferenceCollector
    except ImportError:
        logger.error("Cannot import preference_collector. Run from services/investment-brain/")
        sys.exit(1)

    collector = PreferenceCollector(redis_url=redis_url)

    # Get stats first
    stats = await collector.get_stats()
    logger.info(f"Preference stats: {stats}")

    if not stats.get("ready_for_dpo", False) and stats.get("dpo_pairs", 0) < 10:
        logger.warning(
            f"Only {stats.get('dpo_pairs', 0)} DPO pairs available. "
            f"Need at least 50 for quality training. "
            f"Continue collecting user Accept/Reject preferences via the dashboard."
        )

    # Export pairs
    pairs = await collector.export_dpo_pairs(limit=limit)

    if not pairs:
        logger.warning("No DPO pairs found. Users need to accept/reject analyses first.")
        await collector.close()
        return

    # Write output
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"format": "dpo", "count": len(pairs), "data": pairs}, f, ensure_ascii=False, indent=2)

    logger.info(f"Exported {len(pairs)} DPO pairs to {output_path}")

    # Quality stats
    same_symbol = sum(1 for p in pairs if p.get("match_type") == "same_symbol")
    cross_symbol = sum(1 for p in pairs if p.get("match_type") == "cross_symbol")
    logger.info(f"  Same-symbol pairs: {same_symbol} (higher quality)")
    logger.info(f"  Cross-symbol pairs: {cross_symbol}")

    await collector.close()


def main():
    parser = argparse.ArgumentParser(description="Export DPO preference pairs")
    parser.add_argument("--output", "-o", default="data/dpo_pairs.json", help="Output JSON path")
    parser.add_argument("--redis-url", default=os.getenv("REDIS_URL", "redis://localhost:6379"), help="Redis URL")
    parser.add_argument("--limit", type=int, default=200, help="Max pairs to export")

    args = parser.parse_args()
    asyncio.run(export(args.output, args.redis_url, args.limit))


if __name__ == "__main__":
    main()
