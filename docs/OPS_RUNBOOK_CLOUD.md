# Ops Runbook (Cloud-only)

## What must be always-on?
- market-streamer (optional always-on; scheduler fallback supported)
- event-fuser (streaming pull)
- notifier (streaming pull)

Terraform sets:
- `cpu_idle = false` (Always-on CPU)
- `min_instance_count = 1`

## Alerts to add (recommended)
1) DLQ > 0
2) rate_limit_429_total > 10/min
3) pipeline latency > 30s

## Common failures
### A) Pub/Sub permission denied
- Ensure runtime service account has:
  - roles/pubsub.publisher
  - roles/pubsub.subscriber
  - roles/secretmanager.secretAccessor

### B) Telegram not receiving
- Check notifier logs
- Check secrets exist + correct values
- Ensure subscription is pulling messages

### C) CPU idle not disabled
- Verify Cloud Run service template includes:
  - `resources { cpu_idle = false }`
- Verify min instances is 1

## Cost control
- Prefer Scheduler + Tasks for collectors
- Keep Always-on only for fuser/notifier
