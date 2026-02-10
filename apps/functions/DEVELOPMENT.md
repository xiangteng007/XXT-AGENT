# XXT-AGENT Development Guide

## Prerequisites

- Node.js 22+
- Firebase CLI: `npm i -g firebase-tools`
- Firebase project access: `xxt-agent`

## Quick Start

```bash
# Clone and install
git clone https://github.com/xiangteng007/XXT-AGENT.git
cd XXT-AGENT/apps/functions
npm install

# Set up environment
cp .env.example .env  # Fill in your values

# Run locally with Firebase Emulator
npm run serve

# Run tests
npm test
npm run test:coverage
```

## Project Structure

```
apps/
├── functions/          # Firebase Cloud Functions (backend)
│   ├── src/
│   │   ├── config/     # Centralized configuration (secrets.ts)
│   │   ├── handlers/   # HTTP/webhook request handlers
│   │   ├── services/   # Business logic services
│   │   ├── utils/      # Shared utilities (logger, lock, sanitizer)
│   │   ├── validators/ # Zod input validation schemas
│   │   └── index.ts    # Function entry points
│   └── package.json
├── dashboard/          # Next.js dashboard (frontend)
│   ├── src/app/        # App Router pages
│   └── src/lib/        # Shared utilities
└── docs/               # System documentation
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GCLOUD_PROJECT` | GCP project ID | Yes |
| `INTERNAL_API_KEY` | API key for manual trigger endpoints | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (or via Secret Manager) | Dev only |
| `GEMINI_API_KEY` | Google Gemini API key (via Secret Manager) | Production |
| `OPENAI_API_KEY` | OpenAI API key (via Secret Manager) | Production |

## Key Commands

```bash
# Functions
npm run build          # TypeScript compile
npm run lint:fix       # ESLint auto-fix
npm test               # Run Jest tests
npm run deploy         # Deploy to Firebase

# Dashboard
cd ../dashboard
npm run dev            # Local dev server (port 3000)
npm run build          # Production build
```

## Architecture Notes

- **Rate Limiting**: In-memory Map (per Cloud Function instance)
- **Secrets**: Centralized via `config/secrets.ts` → env vars or Secret Manager
- **Distributed Locks**: Firestore-based via `utils/distributed-lock.ts`
- **AI Safety**: Input sanitization via `utils/ai-sanitizer.ts`
- **Logging**: Structured JSON via `firebase-functions/v2` logger

## Deployment Checklist

1. `npm run lint` — zero errors
2. `npx tsc --noEmit` — zero type errors
3. `npm test` — all tests pass
4. `npm run deploy` — deploy to Firebase
5. Verify health: `curl https://asia-east1-xxt-agent.cloudfunctions.net/butlerApi/health`
