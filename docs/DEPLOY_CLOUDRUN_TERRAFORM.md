# Deploy Guide (Cloud Run + Terraform)

## Required GCP APIs
Enable (once):
- run.googleapis.com
- pubsub.googleapis.com
- cloudtasks.googleapis.com
- cloudscheduler.googleapis.com
- secretmanager.googleapis.com
- artifactregistry.googleapis.com
- cloudbuild.googleapis.com
- iamcredentials.googleapis.com

## Artifact Registry
Terraform will create an Artifact Registry repo:
`ai-me-services`

Images must be pushed before `terraform apply` (or run with placeholder images then update).

## 1) Configure Terraform variables
Create `infra/terraform/terraform.tfvars`:

```hcl
project_id = "YOUR_GCP_PROJECT_ID"
region     = "asia-east1"
env        = "prod"

telegram_bot_token = "YOUR_TELEGRAM_BOT_TOKEN"
telegram_chat_id   = "YOUR_TELEGRAM_CHAT_ID"

line_notify_token  = ""        # optional
webhook_url        = ""        # optional
```

## 2) Build & Push images
Use GitHub Actions workflow in `.github/workflows/deploy-cloudrun.yml`
or run locally (example):
```bash
gcloud auth configure-docker asia-east1-docker.pkg.dev

# build + push market-streamer
docker build -t asia-east1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/ai-me-services/market-streamer:latest services/market-streamer
docker push asia-east1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/ai-me-services/market-streamer:latest
```

Repeat for other services:
- news-collector
- social-dispatcher
- social-worker
- event-fuser
- notifier

## 3) Terraform apply
```bash
cd infra/terraform
terraform init
terraform apply -auto-approve
```

## 4) Verify
- Cloud Run services healthy
- Pub/Sub topics exist
- Scheduler job runs `social.poll.tick`
- Telegram receives `[SEV=..] ...` messages

