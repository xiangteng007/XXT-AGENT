#!/bin/bash
# ────────────────────────────────────────────────────────────────
# BigQuery Analytics Pipeline — Setup Script
# 
# Prerequisites:
#   1. gcloud CLI authenticated with xxt-agent project
#   2. BigQuery API enabled
#   3. Pub/Sub topic 'audit.log' exists
#
# Usage:
#   chmod +x setup_bigquery_pipeline.sh
#   ./setup_bigquery_pipeline.sh
# ────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT_ID="xxt-agent"
DATASET_ID="analytics"
TABLE_ID="audit_events"
TOPIC="audit.log"
SUBSCRIPTION="audit-to-bigquery"
REGION="asia-east1"

echo "══════════════════════════════════════════════════"
echo "  BigQuery Analytics Pipeline Setup"
echo "  Project: ${PROJECT_ID}"
echo "══════════════════════════════════════════════════"

# ── Step 1: Create BigQuery dataset ──────────────────────────
echo ""
echo "▶ Step 1: Creating BigQuery dataset '${DATASET_ID}'..."
bq --location="${REGION}" mk \
  --dataset \
  --description "XXT-AGENT analytics and audit events" \
  --default_table_expiration 0 \
  "${PROJECT_ID}:${DATASET_ID}" 2>/dev/null || echo "  ↳ Dataset already exists, skipping."

# ── Step 2: Create audit_events table ────────────────────────
echo ""
echo "▶ Step 2: Creating table '${TABLE_ID}'..."
bq mk \
  --table \
  --description "Audit events from Pub/Sub" \
  --time_partitioning_field timestamp \
  --time_partitioning_type DAY \
  --clustering_fields "actor,action" \
  "${PROJECT_ID}:${DATASET_ID}.${TABLE_ID}" \
  audit_id:STRING,schema_version:STRING,event_type:STRING,action:STRING,resource:STRING,actor:STRING,trace_id:STRING,timestamp:TIMESTAMP,metadata:JSON \
  2>/dev/null || echo "  ↳ Table already exists, skipping."

# ── Step 3: Create Pub/Sub → BigQuery subscription ───────────
echo ""
echo "▶ Step 3: Creating BigQuery subscription '${SUBSCRIPTION}'..."
gcloud pubsub subscriptions create "${SUBSCRIPTION}" \
  --topic="${TOPIC}" \
  --bigquery-table="${PROJECT_ID}:${DATASET_ID}.${TABLE_ID}" \
  --drop-unknown-fields \
  --project="${PROJECT_ID}" \
  2>/dev/null || echo "  ↳ Subscription already exists, skipping."

# ── Step 4: Grant Pub/Sub service account BigQuery access ────
echo ""
echo "▶ Step 4: Granting Pub/Sub BigQuery write access..."
PUBSUB_SA="service-$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')@gcp-sa-pubsub.iam.gserviceaccount.com"
bq add-iam-policy-binding \
  --member="serviceAccount:${PUBSUB_SA}" \
  --role="roles/bigquery.dataEditor" \
  "${PROJECT_ID}:${DATASET_ID}.${TABLE_ID}" \
  2>/dev/null || echo "  ↳ IAM binding may already exist."

# ── Step 5: Verify ───────────────────────────────────────────
echo ""
echo "▶ Step 5: Verifying setup..."
echo ""
echo "Dataset:"
bq show "${PROJECT_ID}:${DATASET_ID}" 2>/dev/null && echo "  ✅ Dataset OK" || echo "  ❌ Dataset check failed"
echo ""
echo "Table:"
bq show "${PROJECT_ID}:${DATASET_ID}.${TABLE_ID}" 2>/dev/null && echo "  ✅ Table OK" || echo "  ❌ Table check failed"
echo ""
echo "Subscription:"
gcloud pubsub subscriptions describe "${SUBSCRIPTION}" --project="${PROJECT_ID}" --format="value(name)" 2>/dev/null && echo "  ✅ Subscription OK" || echo "  ❌ Subscription check failed"

echo ""
echo "══════════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo ""
echo "  Test: Publish a message to '${TOPIC}' and check"
echo "  BigQuery in ~60 seconds for the row."
echo ""
echo "  Query:"
echo "  SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`"
echo "  ORDER BY timestamp DESC LIMIT 10;"
echo "══════════════════════════════════════════════════"
