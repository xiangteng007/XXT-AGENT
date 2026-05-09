# Telegram Command Bot

> **版本**: v9.2  
> **部署**: Cloud Run (`asia-east1`)  
> **語言**: Python 3.12 (aiohttp + Pydantic)

## 架構

```
telegram-command-bot/
├── src/
│   ├── main.py             # Webhook handler + command router (3000+ lines)
│   ├── config.py           # Pydantic Settings (env vars)
│   ├── tg_api.py           # Telegram Bot API helpers
│   ├── redis_watch.py      # Redis-backed watchlist store
│   ├── investment_brain_client.py  # Gateway client for /analyze
│   └── handlers/           # Modular command handlers (v9.1+)
│       ├── __init__.py     # Exports all handlers
│       ├── accounting.py   # /acc — Kay 會計幕僚
│       ├── advisory.py     # /lex, /sage, /zora — 顧問團
│       ├── audit.py        # Pub/Sub audit event emitter
│       ├── eng.py          # /eng, /estimator, /interior, /scout
│       ├── guardian.py     # /ins — 保險風控
│       ├── invest.py       # /analyze, /watch, /watchlist
│       ├── news.py         # /news — 新聞聚合
│       └── system.py       # /system — GPU/Ollama/Gateway 健康檢查
├── Dockerfile
├── requirements.txt
└── BOTFATHER_COMMANDS.md   # BotFather 指令清單
```

## 環境變數

| 變數 | 說明 | 必填 |
|:---|:---|:---:|
| `TELEGRAM_BOT_TOKEN` | Bot API Token | ✅ |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook 驗證密鑰 | ✅ |
| `OPENCLAW_GATEWAY_URL` | OpenClaw Gateway 端點 | ✅ |
| `INTERNAL_SECRET` | 內部服務認證 | ✅ |
| `OLLAMA_BASE_URL` | 本地推理端點 | ⬜ |
| `OLLAMA_MODEL` | 預設模型 (`qwen3:14b`) | ⬜ |
| `REDIS_HOST` | Redis 連線 | ⬜ |
| `REGULATION_RAG_URL` | 法規 RAG 服務 | ⬜ |
| `ADMIN_CHAT_IDS` | 管理員 Chat ID 白名單 | ⬜ |

## 本地開發

```bash
cd services/telegram-command-bot
pip install -r requirements.txt

# 設定環境變數
export TELEGRAM_BOT_TOKEN=your_token
export OPENCLAW_GATEWAY_URL=http://localhost:3000

# 啟動
python -m aiohttp.web src.main:create_app
```

## 部署

```bash
gcloud run deploy telegram-command-bot \
  --source=services/telegram-command-bot \
  --region=asia-east1 \
  --set-secrets=TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest,OLLAMA_BASE_URL=OLLAMA_BASE_URL:latest
```
