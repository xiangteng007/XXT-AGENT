# Operations Runbook

## 1. Deployment

### Prerequisites

- GCP Project with billing enabled
- `gcloud` CLI authenticated
- Terraform >= 1.6.0
- Docker

### Build & Push Images

```bash
# Build all services
cd services/market-streamer && npm install && npm run build
cd ../fusion-engine && npm install && npm run build
cd ../notifier && npm install && npm run build

# Build Docker images
docker build -t gcr.io/$PROJECT_ID/market-streamer:latest services/market-streamer/
docker build -t gcr.io/$PROJECT_ID/fusion-engine:latest services/fusion-engine/
docker build -t gcr.io/$PROJECT_ID/notifier:latest services/notifier/

# Push to GCR
docker push gcr.io/$PROJECT_ID/market-streamer:latest
docker push gcr.io/$PROJECT_ID/fusion-engine:latest
docker push gcr.io/$PROJECT_ID/notifier:latest
```

### Apply Terraform

```bash
cd infra/terraform/cloudrun
terraform init
terraform plan -var="project_id=$PROJECT_ID"
terraform apply -var="project_id=$PROJECT_ID" \
  -var="telegram_bot_token=$TELEGRAM_TOKEN" \
  -var="telegram_chat_id=$TELEGRAM_CHAT_ID" \
  -var="gemini_api_key=$GEMINI_KEY"
```

## 2. Monitoring

### Health Check Endpoints

| Service | URL | Expected |
|---------|-----|----------|
| market-streamer | `/healthz` | `{"ok": true}` |
| fusion-engine | `/healthz` | `{"ok": true}` |
| notifier | `/healthz` | `{"ok": true}` |

### Logs

```bash
# View logs
gcloud run services logs read market-streamer-prod --region=asia-east1
gcloud run services logs read fusion-engine-prod --region=asia-east1
gcloud run services logs read notifier-prod --region=asia-east1
```

### Metrics to Monitor

- `notificationsSent` — Total pushes sent
- `errorCount` — Processing errors
- `processedCount` — Events processed
- `bufferSize` — Sliding window size

## 3. Troubleshooting

### Service Not Starting

1. Check image exists: `gcloud container images list`
2. Check logs: `gcloud run services logs read SERVICE_NAME`
3. Verify secrets: `gcloud secrets versions access latest --secret=SECRET_NAME`

### No Notifications Received

1. Test endpoint: `curl -X POST https://SERVICE_URL/test`
2. Check Telegram bot token validity
3. Verify chat_id is correct

### High Error Count

1. Check DLQ: `gcloud pubsub subscriptions pull events.dlq.prod --limit=10`
2. Review error logs
3. Check external API rate limits

## 4. Cost Control

| Resource | Est. Monthly Cost |
|----------|-------------------|
| Cloud Run (5 services, min=1) | ~$150 |
| Pub/Sub | ~$10 |
| Secret Manager | ~$1 |
| **Total** | **~$161** |

### Cost Reduction Options

- Set services to `cpu_idle = true` during off-hours
- Reduce `min_instance_count` to 0 for non-critical services
- Use Cloud Scheduler to stop/start services

## 5. Scaling

```hcl
# Increase capacity
scaling {
  min_instance_count = 2
  max_instance_count = 10
}
```

## 6. Rollback

```bash
# List revisions
gcloud run revisions list --service=notifier-prod

# Rollback to previous
gcloud run services update-traffic notifier-prod \
  --to-revisions=notifier-prod-00001=100
```
