# Cloud-Only Real-time Monitoring Pack (TypeScript + Cloud Run Always-on)
This package is designed to be **dropped into** your existing repo:
`C:\Users\xiang\SENTENG-LINEBOT-NOTION`

## What you get
- **Cloud Run Always-on services (TypeScript/Node 18)**
  - market-streamer (always-on loop)
  - news-collector (scheduler tick or always-on)
  - social-dispatcher (scheduler tick -> enqueue tasks)
  - social-worker (task handler)
  - event-fuser (always-on streaming pull -> fused_event)
  - notifier (always-on streaming pull -> Telegram/LINE/Webhook)
- **Pub/Sub event bus**
  - raw.market / raw.news / raw.social / fused.event
- **Cloud Tasks + Scheduler**
  - social task fan-out
- **Terraform IaC**
  - Pub/Sub, Cloud Tasks, Scheduler, Cloud Run, Secret Manager, IAM, Artifact Registry
- **Skills**
  - `.gemini/skills/*` for your AI Agent workflow
- **Docs**
  - fused_event schema, deploy guide, ops runbook

## Quick start (high level)
1) Copy folders into your repo:
- `infra/terraform/`
- `services/`
- `.gemini/skills/`
- `docs/`

2) Create secrets in TF variables:
- Telegram bot token + chat id
- (Optional) LINE Notify token, Webhook URL

3) Build & push docker images (GitHub Actions provided)
4) Terraform apply to deploy

> Notes:
> - This pack **does not replace** your existing Firebase Functions Gen2.
> - It **adds** Cloud Run Always-on services alongside them (recommended).

---
