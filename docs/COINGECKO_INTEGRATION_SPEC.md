# CoinGecko 加密貨幣新聞來源

> **新增日期**: 2026-05-04  
> **整合至**: `services/news-collector`  
> **API**: CoinGecko API v3 (免費, 無需 API Key)  
> **實作狀態**: ✅ 已完成 — `main.py` + `config.py` v9.2

---

## API 端點

| 功能 | 端點 | 速率限制 |
|:---|:---|:---|
| 熱門幣種 | `GET /api/v3/search/trending` | 10-30 calls/min |
| 市場行情 | `GET /api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20` | 10-30 calls/min |
| 全局數據 | `GET /api/v3/global` | 10-30 calls/min |

## 實作範例

```python
async def fetch_coingecko_trending(max_items: int = 7) -> list[dict]:
    """Fetch trending coins from CoinGecko."""
    url = "https://api.coingecko.com/api/v3/search/trending"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    logger.warning(f"[CoinGecko] API returned {resp.status}")
                    return []
                data = await resp.json()
                coins = data.get("coins", [])[:max_items]
                return [
                    {
                        "source": "coingecko",
                        "source_name": "CoinGecko Trending",
                        "headline": f"🔥 {c['item']['name']} ({c['item']['symbol'].upper()}) trending — "
                                    f"Rank #{c['item'].get('market_cap_rank', 'N/A')}",
                        "url": f"https://www.coingecko.com/en/coins/{c['item']['id']}",
                        "summary": f"Price change 24h: {c['item'].get('data', {}).get('price_change_percentage_24h', {}).get('usd', 'N/A')}%",
                        "category": "crypto",
                    }
                    for c in coins
                ]
    except Exception as e:
        logger.error(f"[CoinGecko] Trending fetch failed: {e}")
        return []


async def fetch_coingecko_movers(max_items: int = 10) -> list[dict]:
    """Fetch top market movers from CoinGecko."""
    url = (
        "https://api.coingecko.com/api/v3/coins/markets"
        "?vs_currency=usd&order=market_cap_desc"
        "&per_page=100&page=1&sparkline=false"
        "&price_change_percentage=24h"
    )
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                # Sort by absolute 24h change to find biggest movers
                data.sort(key=lambda x: abs(x.get("price_change_percentage_24h", 0) or 0), reverse=True)
                return [
                    {
                        "source": "coingecko",
                        "source_name": "CoinGecko Markets",
                        "headline": f"📊 {c['name']} ({c['symbol'].upper()}) "
                                    f"{'📈' if (c.get('price_change_percentage_24h') or 0) > 0 else '📉'} "
                                    f"{c.get('price_change_percentage_24h', 0):.1f}% (24h)",
                        "url": f"https://www.coingecko.com/en/coins/{c['id']}",
                        "summary": f"Price: ${c.get('current_price', 0):,.2f} | "
                                   f"MCap: ${c.get('market_cap', 0):,.0f} | "
                                   f"Vol: ${c.get('total_volume', 0):,.0f}",
                        "category": "crypto",
                    }
                    for c in data[:max_items]
                ]
    except Exception as e:
        logger.error(f"[CoinGecko] Markets fetch failed: {e}")
        return []
```

## 整合方式

在 `handle_run()` 中新增第 3 個來源區塊：

```python
# ── 3) CoinGecko 加密貨幣 ──────────────────────────────────
if settings.coingecko_enabled:
    cg_items = await fetch_coingecko_trending()
    cg_items += await fetch_coingecko_movers()
    logger.info(f"[Run:{run_id}] CoinGecko: {len(cg_items)} items")
    # ... 同 Finnhub/RSS 的 dedup + publish 邏輯
```

## Config 新增

```python
# config.py
coingecko_enabled: bool = Field(default=False, env="COINGECKO_ENABLED")
```

## 注意事項

- CoinGecko 免費 API 限制 10-30 calls/min
- 建議 Cloud Scheduler 觸發間隔設為 5 分鐘（而非 1 分鐘）
- 無需 API Key（免費層即可）
