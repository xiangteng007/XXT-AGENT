#!/bin/bash
# Firestore Daily Backup (#22)
# Schedule via Cloud Scheduler or cron:
# gcloud scheduler jobs create http firestore-backup \
#   --schedule="0 2 * * *" --time-zone="Asia/Taipei" \
#   --uri="https://firestore.googleapis.com/v1/projects/xxt-agent/databases/(default)/exportDocuments" \
#   --http-method=POST \
#   --oauth-service-account-email=firebase-adminsdk-xxxxx@xxt-agent.iam.gserviceaccount.com \
#   --message-body='{"outputUriPrefix":"gs://xxt-agent-backups/firestore"}'

# Manual backup command:
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUCKET="gs://xxt-agent-backups/firestore/${TIMESTAMP}"

echo "[Firestore Backup] Starting export to ${BUCKET}..."

gcloud firestore export "${BUCKET}" \
  --project=xxt-agent \
  --async

echo "[Firestore Backup] Export initiated. Check status with:"
echo "  gcloud firestore operations list --project=xxt-agent"
