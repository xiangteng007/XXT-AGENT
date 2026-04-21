import re

def refactor_main():
    with open(r'c:\Users\xiang\XXT-AGENT\services\telegram-command-bot\src\main.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to find `async def handle_telegram`
    match = re.search(r'(async def handle_telegram\(request: web\.Request\) -> web\.Response:\n)(.*?\n)(async def handle_health)', content, re.DOTALL)
    if not match:
        print("Could not find handle_telegram block")
        return

    sig = match.group(1)
    orig_body = match.group(2)

    # 1. Change signature and setup
    new_sig = "async def process_update(update: dict, settings: Settings, store: WatchStore) -> None:\n"
    
    body = re.sub(
        r'    """Handle Telegram webhook updates\."""\n    settings: Settings = request\.app\["settings"\]\n    store: WatchStore = request\.app\["watch_store"\]\n\n    # Verify secret token if configured\n    if settings\.telegram_webhook_secret_token:\n        hdr = get_secret_header\(request\)\n        if hdr != settings\.telegram_webhook_secret_token:\n            logger\.warning\("Invalid webhook secret token"\)\n            return web\.Response\(status=401\)\n\n    try:\n        update = await request\.json\(\)\n    except Exception:\n        return web\.Response\(status=400\)\n',
        '    """Process a single Telegram update."""\n',
        orig_body
    )
    
    # 3. Replace all `return web.Response(status=xxx)` with `return`
    body = re.sub(r'return web\.Response\(status=\d+\)', 'return', body)
    
    # Now we put it back together
    new_func = new_sig + body
    
    # Create the new handle_telegram and polling tasks
    additions = """
async def handle_telegram(request: web.Request) -> web.Response:
    \"\"\"Handle Telegram webhook updates (fallback for webhook mode).\"\"\"
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
    \"\"\"Background task to long-poll Telegram for updates.\"\"\"
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

"""

    content = content.replace(sig + orig_body, new_func + additions)
    
    create_app_orig = '    app.router.add_post("/telegram", handle_telegram)\n    app.router.add_get("/healthz", handle_health)\n    \n    return app'
    create_app_new = '    app.router.add_post("/telegram", handle_telegram)\n    app.router.add_get("/healthz", handle_health)\n    \n    app.on_startup.append(start_telegram_polling)\n    app.on_cleanup.append(cleanup_telegram_polling)\n    \n    return app'
    
    content = content.replace(create_app_orig, create_app_new)
    
    with open(r'c:\Users\xiang\XXT-AGENT\services\telegram-command-bot\src\main.py', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    refactor_main()
    print("Done")
